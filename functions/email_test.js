// Teste de envio usando o _email_system
const { testEmail } = require('./_email_system');

(async () => {
  try {
    const recipient = process.env.TEST_RECIPIENT || 'Tafita1981novo@gmail.com';
    await testEmail(recipient);
    console.log('Teste de envio concluído com sucesso.');
  } catch (err) {
    console.error('Falha no teste de envio:', err);
    process.exit(1);
  }
})();