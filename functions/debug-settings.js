// debug-settings.js - Função de debug para diagnosticar problema com settings
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  const debug = {
    timestamp: new Date().toISOString(),
    env_check: {},
    supabase_test: {},
    raw_data: null,
    error: null
  };

  try {
    // 1. Verificar variáveis de ambiente
    debug.env_check = {
      SUPABASE_URL_exists: !!process.env.SUPABASE_URL,
      SUPABASE_KEY_exists: !!process.env.SUPABASE_KEY,
      SUPABASE_URL_value: process.env.SUPABASE_URL || 'NOT_SET',
      SUPABASE_KEY_length: process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.length : 0,
      SUPABASE_KEY_prefix: process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.substring(0, 20) + '...' : 'NOT_SET'
    };

    // 2. Tentar conectar no Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY
      );

      debug.supabase_test.client_created = true;

      // 3. Tentar buscar settings
      const { data, error } = await supabase
        .from('settings')
        .select('*');

      debug.supabase_test.query_executed = true;
      debug.supabase_test.has_error = !!error;
      
      if (error) {
        debug.error = {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        };
      }

      if (data) {
        debug.supabase_test.data_received = true;
        debug.supabase_test.is_array = Array.isArray(data);
        debug.supabase_test.count = data.length;
        debug.raw_data = data;

        // Converter para objeto
        const settings = {};
        if (Array.isArray(data)) {
          data.forEach(row => {
            if (row && row.key !== undefined) {
              settings[row.key] = row.value;
            }
          });
        }
        debug.supabase_test.converted_count = Object.keys(settings).length;
        debug.supabase_test.settings_object = settings;
      } else {
        debug.supabase_test.data_received = false;
      }
    } else {
      debug.error = 'SUPABASE_URL or SUPABASE_KEY not configured';
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(debug, null, 2)
    };

  } catch (error) {
    debug.error = {
      message: error.message,
      stack: error.stack
    };

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(debug, null, 2)
    };
  }
};
