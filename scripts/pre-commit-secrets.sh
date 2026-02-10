#!/bin/bash
# Pre-commit hook: Block commits with secrets

echo "🔐 Scanning for secrets..."

# Patterns that indicate secrets
PATTERNS=(
    'sk-ant-[a-zA-Z0-9]+'
    'sk-proj-[a-zA-Z0-9]+'
    'ghp_[a-zA-Z0-9]+'
    'gho_[a-zA-Z0-9]+'
    'github_pat_[a-zA-Z0-9]+'
    'Bearer [a-zA-Z0-9_-]+'
    'moltbook_sk_[a-zA-Z0-9]+'
    'am_[a-f0-9]{64}'
    'whsec_[a-zA-Z0-9]+'
    'eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+'
)

FOUND=0

for pattern in "${PATTERNS[@]}"; do
    # Check staged files only
    MATCHES=$(git diff --cached --name-only | xargs grep -lE "$pattern" 2>/dev/null)
    if [ -n "$MATCHES" ]; then
        echo "❌ SECRET DETECTED: $pattern"
        echo "   Files: $MATCHES"
        FOUND=1
    fi
done

if [ $FOUND -eq 1 ]; then
    echo ""
    echo "🚫 COMMIT BLOCKED - Remove secrets before committing"
    echo "   Use AgentMemory vault for secrets: agentmemory secret set NAME value"
    exit 1
fi

echo "✅ No secrets detected"
exit 0
