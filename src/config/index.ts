import dotenv from 'dotenv';

dotenv.config();

export const config = {
  github: {
    token: process.env.GITHUB_TOKEN || '',
  },
  hunter: {
    apiKey: process.env.HUNTER_API_KEY || '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  braveSearch: {
    apiKey: process.env.BRAVE_SEARCH_API_KEY || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
  },
};
