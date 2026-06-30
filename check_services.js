import * as fs from 'fs';
import * as dotenv from 'dotenv';
const envBuf = fs.readFileSync('.env.local');
const config = dotenv.parse(envBuf);
console.log(Object.keys(config));
