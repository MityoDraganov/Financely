# Financely Development Playbooks

This directory contains comprehensive guides for developing features in the Financely codebase.

## Playbooks

### [Implementing New Features](./IMPLEMENTING_NEW_FEATURES.md)
Complete guide for implementing new features, covering:
- Feature planning and architecture
- Code structure and patterns
- Usage tracking integration
- Security and multi-tenancy
- Error handling and logging
- Testing requirements
- Documentation standards
- Deployment checklist

**Use this when:** Starting a new feature or major functionality.

### [Usage Tracking Guide](./USAGE_TRACKING_GUIDE.md)
Detailed guide for implementing usage tracking:
- When to track usage
- How to add tracking to features
- Feature ID naming conventions
- Tracking patterns and examples
- Metadata best practices
- Querying usage data
- Troubleshooting

**Use this when:** Adding usage tracking to a feature or debugging tracking issues.

## Quick Links

### Common Tasks

- **Adding a new Cloud Function**: See [Implementing New Features - Code Structure](./IMPLEMENTING_NEW_FEATURES.md#code-structure--architecture)
- **Adding usage tracking**: See [Usage Tracking Guide - Quick Start](./USAGE_TRACKING_GUIDE.md#quick-start)
- **Setting up auth/authorization**: See [Implementing New Features - Security](./IMPLEMENTING_NEW_FEATURES.md#security--multi-tenancy)
- **Writing tests**: See [Implementing New Features - Testing](./IMPLEMENTING_NEW_FEATURES.md#testing-requirements)

### Code Patterns

- **Create Entity Pattern**: [Implementing New Features - Common Patterns](./IMPLEMENTING_NEW_FEATURES.md#pattern-create-entity)
- **Update Entity Pattern**: [Implementing New Features - Common Patterns](./IMPLEMENTING_NEW_FEATURES.md#pattern-update-entity)
- **Async Operation Pattern**: [Implementing New Features - Common Patterns](./IMPLEMENTING_NEW_FEATURES.md#pattern-async-operation-with-status)

### Reference

- **Feature IDs**: [Usage Tracking Guide - Feature ID Naming](./USAGE_TRACKING_GUIDE.md#feature-id-naming)
- **Import Paths**: [Implementing New Features - Quick Reference](./IMPLEMENTING_NEW_FEATURES.md#quick-reference)
- **Metadata Fields**: [Usage Tracking Guide - Metadata Fields](./USAGE_TRACKING_GUIDE.md#metadata-fields)

## Contributing

When adding new patterns or updating these playbooks:

1. Keep examples practical and copy-paste ready
2. Include both simple and complex scenarios
3. Update the table of contents when adding sections
4. Cross-reference related playbooks
5. Include troubleshooting sections for common issues

## Questions?

- Check existing similar features in the codebase
- Review test files for examples
- Ask the development team

---

**Last Updated:** 2025-01-XX






