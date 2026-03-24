// Sets up process.env variables to force AI client to use the local OpenAI-completions
// relay for integration tests.

process.env.TEST_AI_URL = 'http://111.229.194.14:6543/v1/chat/completions';
process.env.TEST_AI_KEY = 'sk-S6gM1WpsL3njw4PcPYdcuL9T7TBYTtIaSBhGO07pFCGFRllj';
process.env.TEST_AI_MODEL = 'gpt-5.4';

console.log('🤖 Test AI Environment configured: OpenAI Test Runner (concurrency = 3)');
