# aurelia2-turnstile

A Cloudflare Turnstile integration for Aurelia 2 applications. Provides a simple custom element to render the [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) CAPTCHA widget.

## Installation

```bash
npm install aurelia2-turnstile
```

If you are testing a local build before the package is published, you can install from the generated tarball instead:

```bash
npm install ./path/to/aurelia2-turnstile-1.0.0.tgz
```

Replace the filename with the version you packed locally.

## Register the Plugin

`TurnstileConfiguration.configure({...})` is the recommended entry point when you already know your options as a plain object. Use `TurnstileConfiguration.customize(...)` when you want callback-style setup.

Inside of `main.ts`/`main.js`, register the plugin with your sitekey:

```ts
import Aurelia from 'aurelia';
import { TurnstileConfiguration } from 'aurelia2-turnstile';
import { MyApp } from './my-app';

Aurelia.register(
  TurnstileConfiguration.configure({
    sitekey: 'YOUR_CLOUDFLARE_TURNSTILE_SITE_KEY',
  })
).app(MyApp).start();
```

Many Aurelia 2 apps create the Aurelia instance first and register dependencies separately. That pattern works as well:

```ts
import Aurelia from 'aurelia';
import { TurnstileConfiguration } from 'aurelia2-turnstile';
import { MyApp } from './my-app';

const au = new Aurelia();

au.register(
  TurnstileConfiguration.configure({
    sitekey: 'YOUR_CLOUDFLARE_TURNSTILE_SITE_KEY',
  })
);

await au.app(MyApp).start();
```

### Configuration Options

| Option      | Type                              | Default                                                                 | Description                          |
|-------------|-----------------------------------|-------------------------------------------------------------------------|--------------------------------------|
| `sitekey`   | `string`                          | `''`                                                                    | Your Cloudflare Turnstile site key   |
| `theme`     | `'light'` \| `'dark'` \| `'auto'` | `'auto'`                                                                | Widget theme                         |
| `scriptUrl` | `string`                          | `'https://challenges.cloudflare.com/turnstile/v0/api.js'` | URL for the Turnstile script         |

### `configure()` vs `customize()`

- Use `configure({...})` when you already know your plugin options up front.
- Use `customize(config => ...)` when you prefer callback-style configuration or want to set options in multiple statements.

### Callback-style Configuration

```ts
import { TurnstileConfiguration } from 'aurelia2-turnstile';

Aurelia.register(
  TurnstileConfiguration.customize((config) => {
    config.options({
      sitekey: 'YOUR_SITE_KEY',
      theme: 'auto',
    });
  })
);
```

## Content Security Policy

If your app uses a `Content-Security-Policy` header, Turnstile will not load unless Cloudflare's script and iframe origins are allowed.

At minimum, allow:

```text
script-src https://challenges.cloudflare.com
frame-src https://challenges.cloudflare.com
```

If you use Turnstile pre-clearance mode, Cloudflare also recommends keeping `connect-src 'self'` available. See Cloudflare's CSP documentation for the full guidance, including nonce-based setups.

## Usage

When a user completes the Turnstile challenge, the plugin dispatches a `turnstile-verified` custom DOM event with the token in `$event.detail.token`. You can also use the `callback` bindable directly.

### Using the Event (Recommended)

The `turnstile-verified` event is the recommended approach because Aurelia's `.trigger` binding handles method context automatically — no need for `.bind(this)` in your constructor.

**Template (`contact-page.html`):**

```html
<form submit.trigger="sendContactInfo()">
  <label>Name</label>
  <input type="text" value.bind="contactViewModel.name & validate" />

  <label>Email</label>
  <input type="email" value.bind="contactViewModel.email & validate" />

  <label>Subject</label>
  <input type="text" value.bind="contactViewModel.subject & validate" />

  <label>Message</label>
  <textarea value.bind="contactViewModel.message & validate"></textarea>

  <turnstile turnstile-verified.trigger="onTurnstileSuccess($event)"></turnstile>

  <button type="submit">Send</button>
</form>
```

**View Model (`contact-page.ts`):**

```ts
import { inject, newInstanceForScope } from '@aurelia/kernel';
import { IRouter } from '@aurelia/router';
import { IValidationRules } from '@aurelia/validation';
import { IValidationController } from '@aurelia/validation-html';
import { HomeService } from './home-service.js';

interface IContactViewModel {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  turnstileToken: string;
}

@inject(HomeService, IRouter, newInstanceForScope(IValidationController), IValidationRules)
export class ContactPage {
  private contactViewModel: IContactViewModel = {
    name: '', email: '', phone: '', subject: '', message: '', turnstileToken: ''
  };

  constructor(
    private readonly homeService: HomeService,
    private readonly router: IRouter,
    private validationController: IValidationController,
    private validationRules: IValidationRules
  ) { }

  async binding() {
    this.validationRules
      .on(this.contactViewModel)
      .ensure('name').required().withMessage('Name is required')
      .ensure('email').required().email().withMessage('A valid Email is required')
      .ensure('subject').required().withMessage('Subject is required')
      .ensure('message').required().withMessage('Message is required');
  }

  private onTurnstileSuccess(event: CustomEvent): void {
    this.contactViewModel.turnstileToken = event.detail.token;
  }

  private async sendContactInfo(): Promise<void> {
    const result = await this.validationController.validate();
    if (!result.valid) {
      return;
    }

    if (!this.contactViewModel.turnstileToken) {
      console.error('Turnstile token is missing. Please complete the CAPTCHA.');
      return;
    }

    await this.homeService.sendContactInfo(this.contactViewModel);
    await this.router.load('home');
  }
}
```

In this example, `contactViewModel.turnstileToken` is part of the payload sent to the backend, so the token reaches the server together with the rest of the form data.

For example, a service method can submit the full view model as JSON:

```ts
public sendContactInfo(contact: IContactViewModel) {
  return this.http.post('/api/contact', contact);
}
```

### Using the Callback Bindable

You can also use the `callback` bindable directly. Note that you need to `.bind(this)` the method in your constructor to preserve context.

```html
<turnstile callback.bind="onTurnstileSuccess"></turnstile>
```

```ts
export class ContactPage {
  constructor() {
    this.onTurnstileSuccess = this.onTurnstileSuccess.bind(this);
  }

  private onTurnstileSuccess(token: string): void {
    this.turnstileToken = token;
  }
}
```

### Bindable Properties

All bindable properties are optional if the corresponding value is provided via plugin configuration.

| Property    | Type                       | Description                                                                 |
|-------------|----------------------------|-----------------------------------------------------------------------------|
| `sitekey`   | `string`                   | Overrides the configured site key for this instance                         |
| `callback`  | `(token: string) => void`  | Called with the verification token on successful challenge completion       |
| `theme`     | `string`                   | Overrides the configured theme (`'light'`, `'dark'`, or `'auto'`)          |
| `scriptUrl` | `string`                   | Overrides the configured script URL                                        |

### Events

| Event                | Detail                | Description                                         |
|----------------------|-----------------------|-----------------------------------------------------|
| `turnstile-verified` | `{ token: string }`   | Dispatched when the user passes the Turnstile challenge |

### Override Configuration Per-Instance

```html
<turnstile sitekey="DIFFERENT_KEY" theme="dark" turnstile-verified.trigger="onVerify($event)"></turnstile>
```

### Multiple Widgets

You can use multiple `<turnstile>` elements on a single page. The script is loaded only once regardless of how many widgets are rendered.

```html
<turnstile turnstile-verified.trigger="onVerifyForm1($event)"></turnstile>
<turnstile turnstile-verified.trigger="onVerifyForm2($event)" theme="dark"></turnstile>
```

## Server-Side Verification

The token must be verified on your server by calling the Cloudflare siteverify endpoint:

```
POST https://challenges.cloudflare.com/turnstile/v0/siteverify
```

Cloudflare expects `application/x-www-form-urlencoded` form fields, not a JSON request body. The request fields are:

```text
secret=YOUR_SECRET_KEY
response=TOKEN_FROM_EVENT
remoteip=OPTIONAL_USER_IP
```

### .NET Example

Add the secret key to configuration:

```json
{
  "Turnstile": {
    "SecretKey": "YOUR_SECRET_KEY"
  }
}
```

Register the verification service in DI:

```csharp
builder.Services.AddHttpClient<TurnstileVerificationService>();
```

```csharp
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;

public sealed class TurnstileVerificationService(HttpClient httpClient, IConfiguration configuration)
{
  private readonly HttpClient httpClient = httpClient;
  private readonly IConfiguration configuration = configuration;

  public async Task<bool> VerifyTokenAsync(string token, string? remoteIp = null, CancellationToken cancellationToken = default)
  {
    var secretKey = configuration["Turnstile:SecretKey"];

    if (string.IsNullOrWhiteSpace(secretKey))
      throw new InvalidOperationException("Turnstile:SecretKey is not configured.");

    if (string.IsNullOrWhiteSpace(token))
      return false;

    var form = new Dictionary<string, string>
    {
      ["secret"] = secretKey,
      ["response"] = token
    };

    if (!string.IsNullOrWhiteSpace(remoteIp))
      form["remoteip"] = remoteIp;

    using var content = new FormUrlEncodedContent(form);
    using var response = await httpClient
      .PostAsync("https://challenges.cloudflare.com/turnstile/v0/siteverify", content, cancellationToken)
      .ConfigureAwait(false);

    if (!response.IsSuccessStatusCode)
      return false;

    var payload = await response.Content
      .ReadFromJsonAsync<TurnstileVerifyResponse>(cancellationToken: cancellationToken)
      .ConfigureAwait(false);

    return payload?.Success == true;
  }

  private sealed class TurnstileVerifyResponse
  {
    public bool Success { get; set; }
  }
}
```

  Receive the token from the client and verify it before accepting the submission:

  ```csharp
  public sealed class ContactRequest
  {
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string TurnstileToken { get; set; } = string.Empty;
  }

  app.MapPost("/api/contact", async (
    ContactRequest request,
    HttpContext httpContext,
    TurnstileVerificationService turnstileVerificationService,
    CancellationToken cancellationToken) =>
  {
    var remoteIp = httpContext.Connection.RemoteIpAddress?.ToString();

    var isValid = await turnstileVerificationService.VerifyTokenAsync(
      request.TurnstileToken,
      remoteIp,
      cancellationToken);

    if (!isValid)
      return Results.BadRequest(new { message = "Turnstile verification failed." });

    return Results.Ok();
  });
  ```

  The client-side token should be treated as untrusted until the server verifies it successfully.

  ## Testing

  Cloudflare provides test keys so you can develop without creating production widgets immediately.

  Common test sitekeys:

  - `1x00000000000000000000AA`: always passes
  - `2x00000000000000000000AB`: always fails
  - `3x00000000000000000000FF`: forces an interactive challenge

  Matching test secret keys:

  - `1x0000000000000000000000000000000AA`: always passes validation
  - `2x0000000000000000000000000000000AA`: always fails validation
  - `3x0000000000000000000000000000000AA`: returns `timeout-or-duplicate`

  Dummy sitekeys work on local development hosts such as `localhost`, `127.0.0.1`, and `0.0.0.0`.

See the [Cloudflare Turnstile docs](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) for full details.
