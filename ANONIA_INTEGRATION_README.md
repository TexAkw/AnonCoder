# Anonia API Client Integration

This document describes how to use the AnoniaApiClient for anonymizing user prompts in AnonCoder.

## Overview

The AnoniaApiClient integration replaces the previous HTTP-based anonymization service with a more sophisticated Supabase-powered anonymization system that provides:

- Automatic detection of sensitive entities (PII, credentials, etc.)
- Persistent storage of sensitive entries and their anonymized counterparts
- Customizable anonymization rules
- Real-time synchronization across sessions

## Setup

### 1. Environment Configuration

Copy the environment example file and configure your Supabase credentials:

```bash
cp gui/.env.example gui/.env.local
```

Edit `gui/.env.local` with your Supabase project details:

```env
# Your Supabase project URL (found in your Supabase dashboard)
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co

# Your Supabase public anon key (found in your Supabase dashboard)  
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. Supabase Functions

Ensure that the following Supabase Edge Functions are deployed in your project:

- `analyze-message` - Analyzes text for sensitive entities
- `anonymize-message` - Anonymizes text based on detected/stored entities
- `get-sensitive-entries` - Retrieves stored sensitive entries
- `add-sensitive-entries` - Adds new sensitive entries
- `remove-sensitive-entries` - Removes sensitive entries
- `get-entities-categories` - Gets available entity categories

### 3. Database Setup

The anonymization system requires the `anonia_sensitive_entries` table in your Supabase database. This should be created automatically when you deploy the Supabase functions.

## Features

### User Input Anonymization

When enabled, the system will:
1. Analyze user messages for sensitive information
2. Show a confirmation dialog with detected changes
3. Replace sensitive data with anonymized placeholders
4. Send the anonymized version to the LLM

### Configuration Options

Access anonymization settings via the "Privacy" button in the chat interface:

- **Anonymize User Input**: Enable/disable input anonymization
- **Anonymize Assistant Responses**: Enable/disable response anonymization  
- **Auto-Detect Sensitive Information**: Automatically detect new sensitive entities
- **Show Confirmation Dialog**: Show preview before sending anonymized messages

### Sensitive Entry Management

The system automatically:
- Detects common PII patterns (emails, phone numbers, names, etc.)
- Stores detected entities for consistent anonymization
- Maintains anonymization mappings across sessions
- Allows manual addition/removal of sensitive entries

## Usage

1. **Enable anonymization** in the Privacy settings
2. **Type your message** as normal
3. **Review the anonymization preview** if confirmation dialog is enabled
4. **Confirm or cancel** the anonymized message
5. **Send the message** - the anonymized version goes to the LLM

## API Integration Details

The `AnonymizationService` class provides the main interface:

```typescript
import { anonymizationService } from './util/anonymization';

// Anonymize text
const result = await anonymizationService.anonymizeText(userInput);

// Get configuration
const config = anonymizationService.getConfig();

// Update configuration  
anonymizationService.updateConfig({ anonymizeUserInput: true });
```

## Error Handling

If the anonymization service fails:
- Users see an error dialog with option to proceed without anonymization
- The original message can still be sent if user chooses to continue
- Service connection issues are logged for debugging

## Security Notes

- Sensitive entries are stored in your Supabase database
- Anonymization happens before data leaves the client
- Original text is never sent to external LLM services when anonymization is active
- All communications with Supabase use encrypted connections

## Troubleshooting

### Common Issues

1. **"Anonymization service failed"** - Check Supabase configuration and function deployment
2. **Missing environment variables** - Ensure `.env.local` is properly configured
3. **Database errors** - Verify database schema and permissions

### Debug Mode

Enable debug logging by setting localStorage:
```javascript
localStorage.setItem('debug-anonymization', 'true');
```

This will log detailed anonymization operations to the browser console.