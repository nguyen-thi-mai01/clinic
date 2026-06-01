#!/usr/bin/env node
require('dotenv').config({ path: './.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    const models = await genAI.listModels();
    console.log('Available Gemini models:');
    models.forEach((model, i) => {
      console.log(`${i + 1}. ${model.name}`);
    });
  } catch (error) {
    console.error('Error listing models:', error.message);
  }
}

listModels();
