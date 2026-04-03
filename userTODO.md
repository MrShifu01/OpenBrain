# Manual Setup Required

## Telegram Bridge

The Telegram bot and edge function are built but need one-time platform setup to go live.

### 1. Create the Telegram Bot
- Message **@BotFather** on Telegram
- Send `/newbot` and follow the prompts
- Copy the **BOT_TOKEN** you receive

### 2. Set Supabase Secrets
In your Supabase dashboard → Edge Functions → Secrets, add:

| Secret | Value |
|--------|-------|
| `TELEGRAM_BOT_TOKEN` | The token from BotFather |
| `TELEGRAM_SECRET_TOKEN` | Any random string (used to verify webhook calls) |
| `ANTHROPIC_API_KEY` | Your Anthropic server key |

### 3. Deploy the Edge Function
```bash
supabase functions deploy messaging-bridge
```

### 4. Register the Webhook with Telegram
Replace `{TOKEN}` and `{PROJECT_REF}` with your values:
```
https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://{PROJECT_REF}.supabase.co/functions/v1/messaging-bridge&secret_token={TELEGRAM_SECRET_TOKEN}
```

### 5. Run DB Migrations
Apply the two new migrations to your Supabase database:
- `supabase/migrations/004_user_memory.sql`
- `supabase/migrations/005_messaging_connections.sql`

```bash
supabase db push
```

---

Once done, users can connect via **Settings → Telegram → Connect Telegram** in the app.
