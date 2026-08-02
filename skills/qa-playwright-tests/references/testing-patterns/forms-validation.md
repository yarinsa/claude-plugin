# Forms and validation

## Filling

```ts
await page.getByLabel('Email').fill('a@b.com');        // clears, sets, fires input+change
await page.getByLabel('Email').clear();
await page.getByLabel('Bio').pressSequentially('hi');  // real per-key events
await page.getByLabel('Country').selectOption('IL');
await page.getByLabel('Terms').check();
await page.getByRole('radio', { name: 'Monthly' }).check();
await page.getByLabel('Avatar').setInputFiles('./fixtures/a.png');
```

`fill` is the default - it is fast and atomic. Use `pressSequentially` only when per-keystroke behavior is the subject: autocomplete, input masks, character counters, debounced search.

## Label your controls

If `getByLabel` cannot find an input, screen readers cannot either. Fix the markup rather than falling back to a CSS selector - see `testing-patterns/accessibility.md`.

## Native constraint validation

```ts
await page.getByRole('button', { name: 'Submit' }).click();
const message = await page.getByLabel('Email').evaluate((el: HTMLInputElement) => el.validationMessage);
expect(message).toBeTruthy();
await expect(page.getByLabel('Email')).toHaveJSProperty('validity.valid', false);
```

Browser-native bubbles are not DOM nodes, so they cannot be located. Assert via `validationMessage` / `validity`, and do not assert the exact string - it is locale- and browser-specific.

## Custom validation messages

```ts
await page.getByLabel('Email').fill('nope');
await page.getByLabel('Email').blur();
await expect(page.getByRole('alert')).toHaveText('Enter a valid email address');
await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
```

Assert both the visible message and `aria-invalid` / `aria-describedby` - the wiring is what makes the error perceivable to a screen reader, and it breaks independently of the visible text.

Validation timing is behavior worth testing explicitly: on blur, on change, or on submit only. Getting this wrong (validating while the user is still typing) is a common UX defect.

## Submission states

```ts
const submit = page.getByRole('button', { name: 'Save' });
await submit.click();
await expect(submit).toBeDisabled();                       // prevents double-submit
await expect(page.getByRole('status')).toHaveText('Saved');
await expect(submit).toBeEnabled();
```

Double-submit protection is a real bug class. Test it with a slowed response (see `advanced/network-mocking.md`) so the in-flight window is observable.

## Server-side errors

```ts
await page.route('**/api/signup', (r) =>
  r.fulfill({ status: 422, json: { errors: { email: 'Already registered' } } }));
await submitForm(page);
await expect(page.getByRole('alert')).toHaveText('Already registered');
await expect(page.getByLabel('Email')).toHaveValue('a@b.com');   // input NOT cleared
```

That last assertion matters - clearing user input on a server error is a common regression and a real usability failure.

## Cases worth covering

- Empty required fields; whitespace-only input.
- Boundary lengths - max, max+1.
- Unicode, emoji, and RTL text.
- Leading/trailing whitespace - is it trimmed?
- Paste (`pressSequentially` does not cover it; use the clipboard API).
- Browser autofill of a saved password.
- Unsaved-changes warning on navigation.

## Multi-step forms

Assert state survives back-navigation between steps, and that a mid-flow reload either restores or explicitly discards - whichever the product decided. Both behaviors are defensible; silently losing data is not.
