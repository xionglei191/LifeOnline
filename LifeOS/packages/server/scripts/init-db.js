import { initDatabase } from '../src/db/client.js';
try {
    initDatabase();
    console.log('✓ Database initialization complete');
    process.exit(0);
}
catch (error) {
    console.error('✗ Database initialization failed:', error);
    process.exit(1);
}
