# JANANEE Cloudflare deployment source

Upload the CONTENTS of this folder to the root of the JANANEESHOP GitHub repository. Do not upload this folder as a zip file, old deployment archives, .dev.vars, node_modules, database backups or local runtime files.

This is a standalone Worker that serves the same existing application; it does not depend on the previous Sites host or Vinext.

## Required before first deployment
1. Create a D1 database named jananee-db in your Cloudflare account. Replace the placeholder database_id in wrangler.jsonc with its real database UUID.
2. Create the R2 bucket jananee-uploads for new gallery uploads.
3. Set ADMIN_BOOTSTRAP_SALT and ADMIN_BOOTSTRAP_HASH as encrypted Worker secrets. Generate them for the owner password; do not commit the password or secret values to GitHub. These initialize the owner account on its first successful login.
4. Cloudflare Git settings: project name jananeeshop; root /; build command npm run build; deploy command npm run deploy; Node 22 or later.

The deploy command applies schema migrations and deploys the Worker. It refuses deployment while the database UUID is still a placeholder. Existing saved data from localhost or the old online Site is NOT included: migrate that separately after the destination database is configured. Importing existing accounts must preserve their IDs and matching owner IDs on all records.
