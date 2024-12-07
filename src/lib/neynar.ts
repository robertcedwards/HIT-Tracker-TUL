import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { config } from './config';

if (!config.neynarApiKey) {
  throw new Error('Missing Neynar API key');
}

export const neynarClient = new NeynarAPIClient({
  apiKey: config.neynarApiKey
}); 