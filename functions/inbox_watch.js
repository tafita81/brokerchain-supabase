// Watcher simples de inbox usando o _email_system
const { startInboxWatcher } = require('./_email_system');

(async () => {
  try {
    const stop = await startInboxWatcher({
      onEmail: async ({ from, subject, classification, contextKey }) => {
        console.log('Processando:', { from, subject, classification, contextKey });
        // TODO: Persistir em banco e/ou responder automaticamente, se desejado
      }
    });

    console.log('Watcher iniciado. Pressione Ctrl+C para encerrar.');
    process.on('SIGINT', async () => {
      await stop();
      process.exit(0);
    });
  } catch (err) {
    console.error('Falha ao iniciar watcher:', err);
    process.exit(1);
  }
})();