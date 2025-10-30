# 🛡️ Security & Monitoring Guide - BrokerChain v27.0

## 🔐 SECURITY BEST PRACTICES

### 1. Environment Variables

#### ✅ DO's
- Store ALL secrets in Netlify environment variables
- Use different credentials for test vs production
- Rotate API keys regularly (quarterly recommended)
- Use service accounts with minimal permissions
- Never commit `.env` files to git

#### ❌ DON'Ts
- Never hardcode credentials in source code
- Never expose service_role keys from Supabase
- Never share webhook secrets publicly
- Never use production keys in development

### 2. API Security

#### Rate Limiting

Configure rate limits in Netlify to prevent abuse:
```
Site settings → Environment → Rate limiting
- 1000 requests per minute per IP
```

#### CORS Configuration

Current CORS settings allow all origins (`*`). For production, restrict to your domain:

```javascript
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://seudominio.com",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS,DELETE",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  };
}
```

#### Input Validation

All functions validate:
- Required fields are present
- Email formats are valid
- Data types are correct
- SQL injection prevention (via Supabase parameterized queries)

### 3. Supabase Security

#### Row Level Security (RLS)

Enable RLS for production:

```sql
-- Enable RLS on all tables
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies (example - adjust to your needs)
CREATE POLICY "Enable read for authenticated users" ON leads
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for service role" ON leads
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
```

#### Database Backups

Supabase provides automatic backups:
- **Free tier**: 7 days retention
- **Pro tier**: 30 days retention + point-in-time recovery

Manual backup:
```sql
-- Export table to CSV
COPY leads TO '/tmp/leads_backup.csv' CSV HEADER;
```

#### API Keys

- **anon/public key**: Safe to expose in frontend (protected by RLS)
- **service_role key**: NEVER expose - server-side only

### 4. Webhook Security

#### Stripe Webhook Verification

Add signature verification:

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Verify webhook signature
const sig = event.headers['stripe-signature'];
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

try {
  const stripeEvent = stripe.webhooks.constructEvent(
    event.body,
    sig,
    webhookSecret
  );
  // Process event
} catch (err) {
  return { statusCode: 400, body: 'Webhook signature verification failed' };
}
```

#### DocuSign Webhook Verification

Implement HMAC verification for DocuSign webhooks.

### 5. Error Handling

#### Never Expose Sensitive Info

Current implementation logs errors but returns generic messages to clients:

```javascript
catch (error) {
  console.error('Internal error:', error); // Server-side only
  return {
    statusCode: 500,
    body: JSON.stringify({ ok: false, error: 'Internal server error' })
  };
}
```

#### Retry Logic with Backoff

Implemented for external APIs (Stripe, DocuSign) to handle transient failures without exposing system internals.

---

## 📊 MONITORING & OBSERVABILITY

### 1. Netlify Monitoring

#### Function Logs

Access real-time logs:
1. Netlify Dashboard → **Functions**
2. Select a function
3. View execution logs
4. Filter by:
   - Time range
   - Status (success/error)
   - Search term

#### Key Metrics to Monitor

| Metric | Target | Alert If |
|--------|--------|----------|
| Function execution time | < 10s | > 25s (timeout) |
| Error rate | < 1% | > 5% |
| Cron job success rate | > 99% | < 95% |
| Memory usage | < 512MB | > 800MB |

### 2. Supabase Monitoring

#### Database Performance

Monitor in Supabase Dashboard → **Database**:
- **Active connections**: Should be < 50 (60 max on free tier)
- **Disk usage**: Track growth trend
- **Query performance**: Slow queries > 1s
- **Index usage**: Ensure indexes are being used

#### Useful Queries

```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries (requires pg_stat_statements)
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

### 3. Application Metrics

#### Key Performance Indicators (KPIs)

Track these in your dashboard or analytics:

**Lead Pipeline**
- Leads scraped per day
- Leads qualified by Brain (conversion rate)
- Leads dispatched (dispatch rate)
- Leads with payment completed
- Leads with document signed

**System Health**
- Cron job execution success rate
- Average response time per endpoint
- Error rate by function
- Supplier match success rate

**Business Metrics**
- Revenue per lead
- Cost per lead
- Supplier satisfaction
- Buyer satisfaction

### 4. Alerting

#### Critical Alerts

Set up alerts for:

1. **High Error Rate** (> 5% in 5 minutes)
   - Check function logs
   - Verify external API status
   - Check database connectivity

2. **Database Connection Issues**
   - Verify Supabase status
   - Check connection limits
   - Review slow queries

3. **Webhook Failures**
   - Verify webhook endpoints are reachable
   - Check signature verification
   - Review webhook logs in Stripe/DocuSign

4. **Cron Job Failures** (3 consecutive failures)
   - Check function timeout
   - Verify settings toggles
   - Review error logs

#### Alert Channels

Configure in Netlify:
- Email notifications
- Slack integration
- Webhook to monitoring service (PagerDuty, Opsgenie)

### 5. Custom Monitoring Dashboard

Create a simple monitoring endpoint:

```javascript
// monitoring.js
const { getLeads, getSuppliers, getSettings } = require('./_supabase.js');

exports.handler = async (event, context) => {
  try {
    const leads = await getLeads();
    const suppliers = await getSuppliers();
    const settings = await getSettings();
    
    const stats = {
      timestamp: new Date().toISOString(),
      health: 'ok',
      leads: {
        total: leads.length,
        new: leads.filter(l => l.status === 'new').length,
        qualified: leads.filter(l => l.sale_ready).length,
        with_payment: leads.filter(l => l.stripe_payment_completed).length,
        with_signature: leads.filter(l => l.docusign_completed).length,
        with_alerts: leads.filter(l => l.alert_pending).length
      },
      suppliers: {
        total: suppliers.length,
        active: suppliers.filter(s => s.active).length
      },
      automation: {
        dispatcher_enabled: settings.AUTO_DISPATCH_ENABLED,
        scraper_enabled: settings.SCRAPER_ENABLED,
        brain_enabled: settings.BRAIN_ENABLED,
        crawler_enabled: settings.CRAWLER_ENABLED
      }
    };
    
    return {
      statusCode: 200,
      body: JSON.stringify(stats)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ health: 'error', error: error.message })
    };
  }
};
```

Access: `https://seu-dominio.netlify.app/api/monitoring`

### 6. Log Analysis

#### Common Log Patterns to Watch

**Success Pattern**
```
[INFO] Function executed successfully
[INFO] Leads processed: 15
[INFO] Dispatch completed: 8
```

**Warning Pattern**
```
[WARN] Stripe attempt 1 failed, retrying...
[WARN] No supplier available for state: WY
[WARN] Lead awaiting authorization: lead-abc123
```

**Error Pattern**
```
[ERROR] Supabase connection failed
[ERROR] Stripe error: Invalid API key
[ERROR] DocuSign error: Unauthorized
```

#### Log Aggregation

For advanced monitoring, pipe logs to:
- **LogDNA** / **Papertrail**: Log aggregation
- **Sentry**: Error tracking
- **Datadog**: Full observability platform

---

## 🚨 INCIDENT RESPONSE

### 1. High Error Rate

**Symptoms:** Many functions failing
**Steps:**
1. Check Netlify status page
2. Verify Supabase is up
3. Check external APIs (Stripe, DocuSign)
4. Review recent deployments
5. Rollback if necessary

### 2. Database Connection Issues

**Symptoms:** "connection pool exhausted" errors
**Steps:**
1. Check active connections in Supabase
2. Kill long-running queries if needed
3. Increase connection limit (Pro plan)
4. Review function connection management

### 3. Webhook Failures

**Symptoms:** Payments/signatures not updating leads
**Steps:**
1. Verify webhook endpoint is accessible
2. Check webhook logs in Stripe/DocuSign
3. Test webhook manually
4. Verify signature validation
5. Reprocess failed events

### 4. Cron Job Failures

**Symptoms:** Leads not being processed automatically
**Steps:**
1. Check cron job logs in Netlify
2. Verify settings toggles in database
3. Test function manually
4. Check function timeout limits
5. Review recent code changes

---

## 📈 PERFORMANCE OPTIMIZATION

### Database Optimization

1. **Analyze Query Performance**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM leads WHERE status = 'new' AND sale_ready = true;
   ```

2. **Add Missing Indexes**
   ```sql
   CREATE INDEX idx_custom ON leads(custom_field) WHERE condition;
   ```

3. **Vacuum Regularly** (automatic on Supabase)

### Function Optimization

1. **Reduce Cold Start Time**
   - Minimize dependencies
   - Use lazy loading for heavy modules
   - Keep functions focused and small

2. **Batch Operations**
   - Use `updateLeads()` instead of multiple `updateLead()` calls
   - Batch Supabase queries when possible

3. **Caching**
   - Cache frequently accessed data (settings, tenants)
   - Use Netlify Edge caching for static content

---

## ✅ SECURITY CHECKLIST

Before going to production:

### Credentials
- [ ] All production keys configured
- [ ] Test keys removed
- [ ] Webhook secrets set
- [ ] Service account permissions minimal

### Database
- [ ] RLS enabled on sensitive tables
- [ ] Backups configured
- [ ] Connection pooling optimized
- [ ] Indexes created

### API
- [ ] CORS restricted to domain
- [ ] Rate limiting configured
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak info

### Monitoring
- [ ] Logs being collected
- [ ] Alerts configured
- [ ] Dashboard created
- [ ] Incident response plan documented

### Testing
- [ ] All webhooks tested
- [ ] Error handling tested
- [ ] Retry logic tested
- [ ] Load testing performed

---

**🔒 Security is an ongoing process, not a one-time task!**

*BrokerChain v27.0 - Enterprise-Grade Security & Monitoring*
