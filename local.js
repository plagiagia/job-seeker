import http from 'node:http';
import handler from './server.js';
const server = http.createServer(handler);
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`Mission Control running on port ${server.address().port}`));
