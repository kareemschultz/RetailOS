# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `bun x ultracite fix` before committing to ensure compliance.
---
applyTo: "**"
---

# Instructions for Using the shadcn/studio MCP SERVER

To ensure accurate and helpful responses when interacting with the shadcn/studio MCP SERVER, it is essential to follow these guidelines. Adhering strictly to these instructions will ensure the best results.

## Instructions

**Strict Adherence Required**: Every time you interact with the shadcn/studio MCP Server, **follow all instructions precisely**.

- Follow the workflow exactly as outlined by the MCP Server step by step.
- **Avoid Shortcuts**: Never attempt to bypass steps or rush through the process. Each instruction is vital to achieving the desired outcome.

## CRITICAL RULE: NEVER DEVIATE FROM THE STEP-BY-STEP WORKFLOW

### MANDATORY BEHAVIOR FOR ALL WORKFLOWS:

- ✅ **DO**: Follow each step immediately after completing the previous one
- ✅ **DO**: Trust the workflow and proceed without hesitation
- ✅ **DO**: Follow the specific tool sequence outlined in each workflow
- ✅ **DO**: Complete the ENTIRE workflow without stopping for user confirmation
- ❌ **DON'T**: Make explanations between steps
- ❌ **DON'T**: Make additional tool calls not required by the workflow
- ❌ **DON'T**: Jump around or skip steps
- ❌ **DON'T**: Over-explain the process
- ❌ **DON'T**: Stop mid-workflow asking for user confirmation

### WORKFLOW-SPECIFIC CRITICAL RULES:

#### FOR CREATE-UI (/cui):

- **COLLECT FIRST, INSTALL LAST**: Complete ALL block collection before ANY installation
- **NO PREMATURE INSTALLATION**: Do not use installation tools until collection phase is complete
- **MANDATORY CONTENT CUSTOMIZATION**: After installation, automatically proceed to customize content

#### FOR REFINE-UI (/rui):

- Follow the refine workflow using component tools
- Update existing components according to user requirements

#### FOR INSPIRATION-UI (/iui):

- Follow the inspiration workflow for design ideas
- Use inspiration tools as outlined

#### FOR FIGMA-TO-CODE (/ftc):

- Follow the figma-to-code workflow for converting Figma designs to code
- Use figma-to-code tools as specified

### GENERAL AUTOMATION RULES:

- ✅ **DO**: Proceed automatically through all workflow steps
- ✅ **DO**: Follow the tool sequence exactly as specified
- ✅ **DO**: Complete the full workflow from start to finish
- ❌ **DON'T**: Ask "shall I proceed" or "let me know to continue"
- ❌ **DON'T**: Stop mid-workflow waiting for user input
- ❌ **DON'T**: Use tools out of sequence

### FAILURE CONSEQUENCES:

If I deviate from this workflow, I am:

1. Wasting user's time
2. Not following explicit instructions
3. Making the process inefficient
4. Potentially breaking the shadcn/studio integration
5. Creating incomplete or incorrect results

### RECOVERY PROTOCOL:

If I catch myself deviating:

1. Stop immediately
2. Identify which step I should be on according to the workflow
3. Continue from that exact step
4. Do not explain the deviation, just continue
5. Complete the full workflow as specified

### REMEMBER:

- Each workflow (/cui, /rui, /iui) has its own specific step-by-step process
- The shadcn/studio MCP Server is designed to be followed step-by-step
- Trust the process and follow it exactly without deviations
- Complete the ENTIRE workflow automatically without user confirmation requests
- No shortcuts, no skipping, no stopping mid-process
