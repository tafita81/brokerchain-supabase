// _ai_core.js
// Integração completa com OpenAI GPT-4o-mini para processamento automático de leads
// Inclui retry logic com backoff exponencial

const OpenAI = require('openai');
const { logInfo, logError, logExternalApiCall, logPerformance } = require('./_logger');

class AICore {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.apiKey = apiKey;
    this.client = new OpenAI({
      apiKey: this.apiKey,
    });
    this.model = 'gpt-4o-mini';
    this.maxRetries = 3;
    this.initialRetryDelay = 1000; // 1 segundo
  }

  /**
   * Retry com backoff exponencial
   */
  async retryWithBackoff(fn, retries = this.maxRetries) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        const isLastAttempt = i === retries - 1;
        
        // Não fazer retry em erros 4xx (exceto 429)
        if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }

        if (isLastAttempt) {
          throw error;
        }

        const delay = this.initialRetryDelay * Math.pow(2, i);
        logInfo(`Retry attempt ${i + 1}/${retries} after ${delay}ms`, {
          error: error.message,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Processa um lead usando GPT-4o-mini
   * Qualifica, categoriza e gera insights sobre o lead
   */
  async processLead(leadData) {
    const startTime = Date.now();

    try {
      logExternalApiCall('OpenAI', '/chat/completions', {
        model: this.model,
        operation: 'processLead',
      });

      const prompt = this.buildLeadProcessingPrompt(leadData);

      const response = await this.retryWithBackoff(async () => {
        return await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an AI assistant specialized in qualifying emergency service leads and B2B sourcing opportunities. Analyze leads and provide structured insights.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3, // Baixa temperatura para respostas mais consistentes
          max_tokens: 1000,
        });
      });

      const result = this.parseLeadProcessingResponse(response);
      
      const duration = Date.now() - startTime;
      logPerformance('processLead', duration, {
        leadId: leadData.id,
        category: result.category,
      });

      return result;
    } catch (error) {
      logError('Error processing lead with AI', error, {
        leadId: leadData.id,
        model: this.model,
      });
      
      // Retornar resultado padrão em caso de falha
      return {
        qualified: false,
        category: leadData.category || 'general',
        urgency: leadData.urgency || 'unknown',
        confidence: 0,
        reasoning: 'AI processing failed',
        error: error.message,
      };
    }
  }

  /**
   * Gera email de outreach personalizado para supplier
   */
  async generateOutreachEmail(lead, supplier) {
    const startTime = Date.now();

    try {
      logExternalApiCall('OpenAI', '/chat/completions', {
        model: this.model,
        operation: 'generateOutreachEmail',
      });

      const prompt = this.buildOutreachEmailPrompt(lead, supplier);

      const response = await this.retryWithBackoff(async () => {
        return await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at writing professional, urgent, and persuasive B2B emails for emergency services and sourcing opportunities.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });
      });

      const email = response.choices[0]?.message?.content || '';
      
      const duration = Date.now() - startTime;
      logPerformance('generateOutreachEmail', duration);

      return email;
    } catch (error) {
      logError('Error generating outreach email', error, {
        leadId: lead.id,
        supplierId: supplier.id,
      });
      
      // Retornar email template básico em caso de falha
      return this.getFallbackOutreachEmail(lead, supplier);
    }
  }

  /**
   * Analisa resposta de buyer para determinar próximos passos
   */
  async analyzeBuyerResponse(responseText, leadContext) {
    try {
      logExternalApiCall('OpenAI', '/chat/completions', {
        model: this.model,
        operation: 'analyzeBuyerResponse',
      });

      const prompt = `Analyze this buyer response and determine the intent and next action:

Buyer Response: "${responseText}"

Lead Context:
- Category: ${leadContext.category}
- Urgency: ${leadContext.urgency}
- Buyer Type: ${leadContext.buyer_type}

Provide a JSON response with:
- intent: (interested, not_interested, needs_info, ready_to_purchase, price_inquiry)
- sentiment: (positive, neutral, negative)
- next_action: (send_quote, schedule_call, send_info, close_lead, follow_up)
- urgency_score: (1-10)
- key_concerns: array of concerns mentioned
`;

      const response = await this.retryWithBackoff(async () => {
        return await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an AI that analyzes buyer responses and determines sales intent. Always respond with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 300,
        });
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch (error) {
      logError('Error analyzing buyer response', error);
      
      return {
        intent: 'needs_info',
        sentiment: 'neutral',
        next_action: 'follow_up',
        urgency_score: 5,
        key_concerns: [],
      };
    }
  }

  /**
   * Constrói prompt para processar lead
   */
  buildLeadProcessingPrompt(leadData) {
    return `Analyze this emergency/sourcing lead and provide qualification:

Title: ${leadData.title}
Description: ${leadData.body || 'N/A'}
State: ${leadData.state}
Buyer Type: ${leadData.buyer_type}
Urgency: ${leadData.urgency}
Tenant: ${leadData.tenant}
Category: ${leadData.category || 'unknown'}

Provide a JSON response with:
- qualified: boolean (is this a real, actionable lead?)
- category: string (water-mitigation, hvac, roofing, solar, b2b-sourcing, etc.)
- urgency: string (1-2h, today, this-week, unknown)
- confidence: number (0-1, how confident are you?)
- reasoning: string (brief explanation)
- estimated_value: string (low, medium, high, very-high)
- key_requirements: array of strings (what does the buyer need?)
`;
  }

  /**
   * Parse resposta do processamento de lead
   */
  parseLeadProcessingResponse(response) {
    try {
      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      
      return {
        qualified: parsed.qualified || false,
        category: parsed.category || 'general',
        urgency: parsed.urgency || 'unknown',
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || '',
        estimated_value: parsed.estimated_value || 'medium',
        key_requirements: parsed.key_requirements || [],
      };
    } catch (error) {
      logError('Error parsing AI response', error);
      return {
        qualified: false,
        category: 'general',
        urgency: 'unknown',
        confidence: 0,
        reasoning: 'Failed to parse AI response',
      };
    }
  }

  /**
   * Constrói prompt para email de outreach
   */
  buildOutreachEmailPrompt(lead, supplier) {
    return `Write a professional, urgent outreach email for this opportunity:

Supplier: ${supplier.name}
Buyer Need: ${lead.title}
Location: ${lead.state}
Urgency: ${lead.urgency}
Category: ${lead.category}
Buyer Type: ${lead.buyer_type}

Requirements:
- Professional but urgent tone
- Clear call-to-action
- Emphasize time-sensitivity
- Include key opportunity details
- Keep it concise (200-300 words)
- Sign as "BrokerChain Dispatch Team"

Write only the email body, no subject line.
`;
  }

  /**
   * Email de fallback em caso de falha na geração por AI
   */
  getFallbackOutreachEmail(lead, supplier) {
    return `Hi ${supplier.name},

We have an urgent ${lead.category} opportunity in ${lead.state} that matches your service area.

Buyer Need: ${lead.title}
Urgency: ${lead.urgency}
Type: ${lead.buyer_type}

This is a qualified lead requiring immediate response. Please reply ASAP if you can service this request.

Best regards,
BrokerChain Dispatch Team`;
  }
}

module.exports = AICore;
