# WhatsApp AI Chatbot

This project is a WhatsApp chatbot designed to detect scams, fake news, and potential viruses through the use of external APIs. It also collects user feedback to assess its effectiveness.

## Features

- **Scam Detection**: Analyzes incoming messages to identify potential scams using external APIs.
- **Fake News Detection**: Checks the validity of information to prevent the spread of misinformation.
- **Virus Detection**: Scans messages for potential virus links or harmful content.
- **User Feedback Collection**: Gathers user feedback to improve the chatbot's performance and effectiveness.

## Project Structure

```
whatsapp-ai-chatbot
├── src
│   ├── index.ts               # Entry point of the application
│   ├── bot
│   │   └── messageHandler.ts   # Handles incoming messages and responses
│   ├── services
│   │   ├── analysisService.ts   # Analyzes messages for scams and misinformation
│   │   └── feedbackService.ts    # Collects and stores user feedback
│   ├── database
│   │   ├── client.ts            # Manages database connection
│   │   └── schema.sql           # SQL schema for PostgreSQL database
│   └── config.ts                # Configuration constants
├── package.json                 # npm configuration file
├── tsconfig.json                # TypeScript configuration file
└── README.md                    # Project documentation
```

## Setup Instructions

1. **Clone the repository**:
   ```
   git clone <repository-url>
   cd whatsapp-ai-chatbot
   ```

2. **Install dependencies**:
   ```
   npm install
   ```

3. **Set up the PostgreSQL database**:
   - Create a PostgreSQL database and run the `schema.sql` file to set up the necessary tables.

4. **Configure environment variables**:
   - Update the `config.ts` file with your API keys and database connection strings.

5. **Run the application**:
   ```
   npm start
   ```

## Usage

- Once the chatbot is running, it will listen for incoming messages on WhatsApp.
- Users can interact with the chatbot by sending messages, and it will respond with relevant information regarding scams, fake news, or potential viruses.

## Feedback

At the end of each interaction, users will be prompted to provide feedback on whether the chatbot helped resolve their issue. This feedback will be stored in the database for future analysis.

## License

This project is licensed under the MIT License.