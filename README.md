# Quicke - LLM Response Comparison Tool

Quicke is a web application that allows you to send a single prompt to multiple LLMs (Large Language Models) and view their responses side by side.

## Features

- Send a single prompt to multiple LLMs simultaneously
- View responses from different LLMs side by side
- Select which LLMs to include in your comparison
- Copy responses to clipboard with a single click
- Clean, responsive UI that works on desktop and mobile

## Supported LLMs

- OpenAI GPT-4
- Anthropic Claude 3 Sonnet
- Google Gemini Pro

## Getting Started

### Prerequisites

- Node.js 18+ installed
- API keys for the LLMs you want to use

### API Keys Setup

1. **OpenAI API Key**:
   - Visit [OpenAI API](https://platform.openai.com/api-keys) to create an API key
   - Make sure your account has access to GPT-4

2. **Anthropic API Key**:
   - Visit [Anthropic Console](https://console.anthropic.com/) to get an API key
   - You'll need access to Claude models

3. **Google AI API Key**:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey) to create an API key
   - You need to have a Google Cloud project with the Generative Language API enabled
   - Enable the Gemini API in Google Cloud Console if needed

### Application Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the root directory with your API keys:
   ```
   OPENAI_API_KEY=your_openai_key_here
   ANTHROPIC_API_KEY=your_anthropic_key_here
   GOOGLE_API_KEY=your_google_key_here
   ```

### Running the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Troubleshooting

### Gemini API Issues

If you encounter errors with the Gemini API:

1. **Correct model naming format**: 
   - The Gemini API model names have changed over time
   - Our application tries different formats: `gemini-1.0-pro`, `gemini-pro`, `gemini-1.5-pro`, `gemini-1.5-flash`
   - Check the [Google AI documentation](https://ai.google.dev/models/gemini) for the latest model names

2. **API permissions**:
   - Make sure you're using an API key from Google AI Studio
   - The key should have access to the Gemini models you want to use
   - You may need to enable the Generative Language API in your Google Cloud project

3. **Version compatibility**:
   - API versions may change: our app is configured for v1, but documentation may reference v1beta
   - If you encounter 404 errors, it might be due to API version mismatches
   - Update the `@google/generative-ai` package to the latest version

4. **Region availability**:
   - Gemini may not be available in all regions
   - Check Google's documentation for regional availability

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- OpenAI, Anthropic, and Google Generative AI SDKs

## License

This project is licensed under the MIT License. 