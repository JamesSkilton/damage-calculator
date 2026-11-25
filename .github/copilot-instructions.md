# Pull requests

When asked to create a pull request, fetch the latest `main` and create a new branch from the updated remote `main`. Apply the requested changes to that branch, ensure it includes the latest `main` before opening the pull request, and target `main`. Preserve existing work and do not overwrite or discard uncommitted changes.

# Copilot Design Instructions — UI/UX Standards

## Design Philosophy
Create interfaces that feel intentional, modern, polished, and distinctive. Avoid generic AI-generated design patterns. Prioritize visual hierarchy, purposeful typography, whitespace, consistency, and usability.

Every design should feel like it was designed by a human with a clear visual direction—not assembled from a generic UI template.

## 1. Visual Identity & Art Direction
- Establish a cohesive visual direction before building the interface.
- Use a purposeful color palette. Avoid defaulting to cream/off-white backgrounds unless the brand calls for it.
- Avoid excessive decorative effects, gradients, glows, and blurred backgrounds.
- Use contrast, spacing, and composition to create visual interest rather than relying on effects.
- Keep the interface visually calm, confident, and intentional.
- Avoid overused AI aesthetics and predictable template layouts.

## 2. Typography
- Use typography with personality and purpose.
- Choose fonts that complement the product's brand and audience.
- Avoid defaulting to Instrument Serif, generic editorial serif pairings, or trendy font combinations without a clear reason.
- Do not italicize random words in headlines for decoration.
- Use a deliberate type scale for headlines, body text, labels, and supporting content.
- Prioritize readability, proper line height, and controlled line lengths.
- Avoid excessive uppercase labels, eyebrow text, and letter spacing.

## 3. Layout & Composition
- Use a clear visual hierarchy with intentional alignment and spacing.
- Avoid placing every element inside a card.
- Do not default to three-column icon-card layouts.
- Mix layout patterns where appropriate: open sections, split layouts, grids, lists, tables, visual features, and asymmetric compositions.
- Use whitespace to separate content instead of borders around everything.
- Avoid unnecessary numbered sections unless numbering communicates structure or progression.
- Make page composition responsive and balanced at all screen sizes.

## 4. Components & UI Patterns
- Use components when they improve consistency, usability, or maintainability—not simply to wrap every element in a container.
- Avoid unnecessary cards, colored left borders, pills, badges, and eyebrow labels.
- Avoid adding arrows to every button. Use arrows only when they communicate navigation or direction.
- Keep button styles consistent and use clear action-oriented labels.
- Avoid decorative icon usage. Icons must communicate meaning.
- Do not use sparkle icons or novelty symbols as generic decoration.
- Avoid unnecessary status dots, pulsing indicators, or fake live states.

## 5. Color & Effects
- Use color sparingly and intentionally.
- Avoid excessive glow effects behind hero sections.
- Avoid colored left borders as a default way to distinguish content.
- Do not use gradients unless they are part of the established art direction.
- Use shadows only to communicate depth and elevation.
- Avoid fake texture, noise, dithering, and visual effects that reduce clarity.
- Maintain accessible contrast between text, backgrounds, and interactive elements.

## 6. Content & Copy
- Write natural, concise, meaningful interface copy.
- Avoid generic marketing language and filler.
- Do not use words like "real," "quiet," "seamless," or "effortless" as empty marketing descriptors.
- Avoid fake statistics, fabricated testimonials, placeholder metrics, or unsupported claims.
- Avoid overly short copy that makes the interface feel artificial or incomplete.
- Vary sentence structure naturally. Avoid repetitive two-word or two-sentence patterns.
- Use realistic content that fits the product and context.

## 7. Motion & Interaction
- Animation should serve a purpose.
- Avoid making every section fade in or animate on scroll.
- Avoid pulsing dots and unnecessary looping animations.
- Use motion to provide feedback, explain transitions, or guide attention.
- Respect reduced-motion preferences.
- Keep interactions responsive and subtle.

## 8. Hero & Landing Page Design
- Create a distinctive hero layout with a strong focal point.
- Do not rely on blurred glows behind a hero as the primary visual feature.
- Avoid the predictable formula of eyebrow + oversized headline with one italic word + subtitle + two buttons + three feature cards.
- Use imagery, product UI, composition, typography, or spatial contrast to make the hero interesting.
- Ensure the hero communicates the product and its value quickly.

## 9. Data Integrity & Realism
- Never invent statistics, ratings, testimonials, user counts, performance metrics, or social proof.
- If data is unavailable, omit it or clearly mark it as illustrative.
- Do not fabricate "live" indicators or operational status.
- Make empty states, loading states, and error states intentional and useful.

## 10. Responsive & Accessible Design
- Design for mobile, tablet, and desktop.
- Ensure keyboard accessibility and visible focus states.
- Use semantic HTML and accessible labels.
- Maintain sufficient contrast and usable touch target sizes.
- Avoid motion that can cause discomfort.
- Do not rely on color alone to communicate meaning.

## 11. Final Quality Check
Before considering a design complete, verify:

- [ ] The design has a recognizable visual direction.
- [ ] The layout does not feel like a generic AI template.
- [ ] Typography and spacing are intentional.
- [ ] Cards are used only where they add value.
- [ ] Icons and decorative elements are purposeful.
- [ ] No fabricated content or metrics are present.
- [ ] Color and effects are restrained.
- [ ] The page is responsive and accessible.
- [ ] Interactions work and provide meaningful feedback.
- [ ] The overall experience feels polished and cohesive.

**Default rule:** When uncertain, simplify. Prefer strong typography, thoughtful composition, meaningful content, and functional clarity over decorative UI patterns.
