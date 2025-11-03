# 📋 Quick Start Prompt for Next Claude Code Instance

**Copy and paste this entire prompt to the next Claude Code session:**

---

I'm taking over the Abyrith MVP project at 92% completion (Week 3, Day 1 complete).

## Context (Read These First)
Please read in this order:
1. `/Users/james/code/secrets/HANDOFF-GUIDE.md` - Complete handoff guide
2. `/Users/james/code/secrets/PROJECT-DASHBOARD.md` - Current status
3. `/Users/james/code/secrets/WEEK-3-DAY-1-SUMMARY.md` - Today's work

## Project Status
- **Progress:** 92% complete (Week 2 complete)
- **Remaining:** 8% (6 critical fixes + 2 workstreams)
- **Timeline:** 5-6 days to 100% MVP
- **Today's Work:** Retrospective complete, 2 of 8 critical issues fixed

## What Was Fixed Today
1. ✅ API endpoint paths in `workers/src/index.ts` - Now matches documentation
2. ✅ Database schema in `supabase/migrations/20241102000001_initial_schema.sql` - Now has envelope encryption fields

## Critical Next Steps (Priority Order)

### STEP 1: Verify Encryption Implementation (HIGH PRIORITY - 2 hours)
**BLOCKER:** Database schema was just changed to support envelope encryption. Must verify implementation matches.

Action:
```bash
# Read the encryption file
Read: /Users/james/code/secrets/abyrith-app/lib/crypto/encryption.ts

# Check if it creates these 5 fields:
- encrypted_value (encrypted secret)
- encrypted_dek (encrypted Data Encryption Key)
- secret_nonce (nonce for secret)
- dek_nonce (nonce for DEK)
- auth_tag (GCM authentication tag)

# If YES: Continue to Step 2
# If NO: Update encryption.ts to match new schema
```

### STEP 2: Fix Remaining 6 Critical Issues (6 hours)
Use parallel agents for:
- Create conversations schema documentation
- Fix FireCrawl endpoint path references
- Standardize rate limiting values
- Document implemented features (audit, AI, guided acquisition)
- Add version headers to all workstream docs

### STEP 3: Deploy Week 3 Workstreams (3-4 days)
- Workstream 8: Sentry error tracking integration
- Workstream 9: Team management UI
- End-to-end testing with real APIs
- Final validation

## My Execution Plan
I will follow the "PHASE 1: Validate What's Fixed" approach from HANDOFF-GUIDE.md:

1. **Verify encryption implementation** matches new database schema (2-3 hours)
2. **Test API endpoint paths** work correctly
3. **Validate database schema** applied correctly

Then proceed to **PHASE 2: Fix Remaining Critical Issues** using parallel agents.

## Questions Before Starting
1. Should I verify encryption first (recommended) or proceed directly to fixes?
2. Do we have real API keys configured (ANTHROPIC_API_KEY, FIRECRAWL_API_KEY)?
3. Any priority changes from the plan in HANDOFF-GUIDE.md?

Starting with encryption verification unless you direct otherwise.
