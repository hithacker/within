# Cloud sync setup

Within uses Supabase Auth and Postgres for optional account sync. The Fly API remains responsible for AI analysis and authenticated account deletion.

## 1. Create the project

1. Sign in to [Supabase](https://supabase.com/dashboard) with your personal account.
2. Create a project named `within` in the Singapore region when available.
3. Apply the migrations in order with `npx supabase db push` after linking the project.

The migrations create journal sync first, followed by the knowledge platform's
tenant, pack-version, review, test-case, enrollment, progress, and audit tables.
Published pack versions are immutable. Mobile clients read them through the Fly
API and do not receive authoring-table credentials.

## 2. Configure mobile redirects

In **Authentication > URL Configuration**, add:

```text
within://auth/callback
```

## 3. Enable Google

1. In a personal Google Cloud project, configure the OAuth consent screen.
2. Create a Web OAuth client.
3. Add the callback URL shown by **Supabase > Authentication > Providers > Google** to the Google client's authorized redirect URIs.
4. Paste the Google client ID and secret into the Supabase Google provider and enable it.

Only request the default identity scopes. Within does not need Drive, contacts, or calendar access.

## 4. Enable Apple before App Store submission

Within uses Apple's native Authentication Services flow on iOS. In the Supabase
Apple provider, enable Apple and add the native bundle ID `com.hirenthacker.withinjournal`
to the allowed Client IDs. The Expo configuration enables the Sign in with Apple
entitlement automatically.

The Supabase dashboard requires an Apple client secret when enabling the provider.
Generate it from a dedicated Sign in with Apple `.p8` key, keep that key outside
the repository, and schedule rotation before the generated secret expires. Apple
client secrets can be valid for at most six months.

Google login must not ship on iOS without this equivalent Apple login option.

Validate the personal Apple team and let EAS create the signing credentials by
running this yourself because the prompt requests your Apple password and 2FA:

```bash
npx eas-cli@latest credentials --platform ios
```

Choose `production`, answer yes to Apple login, and use the personal Apple ID.

## 5. Configure local development

Copy the values from **Supabase > Project Settings > API** into `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

The anon key is intended for clients. Row-level security prevents one signed-in user from reading another user's journal.

## 6. Configure EAS preview builds

Run these interactively and paste each value when prompted:

```bash
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --visibility sensitive
```

Then build the tester APK:

```bash
npx eas-cli@latest build --platform android --profile preview
```

## 7. Configure Fly account deletion

Copy the server-only service-role key from Supabase and run this locally. Do not put this key in chat, source control, Expo, or the mobile app.

```bash
fly secrets set \
  SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY \
  --app within-reflection-api-hiren
```

Deploy after setting the secrets:

```bash
fly deploy --app within-reflection-api-hiren --remote-only
```

## Sync behavior

- Signed-out journals remain local.
- First sign-in merges local and cloud entries by entry ID and `updatedAt`.
- Changes are synced after a short delay.
- Signing out leaves the current local copy on the device.
- Deleting an account removes the auth user and cascades deletion to the synced journal.
- Simultaneous edits on multiple devices currently use last-write-wins snapshot sync.

## Published skill collections

The API serves the latest published immutable version at:

```text
GET /v1/collections/:collectionId
```

Pin an exact semantic version with `?version=1.0.0`. The mobile app includes a
bundled Relationships fallback so a temporary content-service failure does not
remove skills from the interface.
