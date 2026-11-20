# aurelia2-google-analytics

This plugin uses the Universal Analytics `ga` API. It can track Aurelia router navigation, clicks on elements with analytics data attributes, and uncaught browser errors.

Register `GoogleAnalyticsConfiguration` and resolve `IGoogleAnalytics` from the application container. If your app already supplies `window.ga`, enable tracking with:

```ts
analytics.attach({
  useNativeGaScript: false,
  pageTracking: { enabled: true },
  clickTracking: { enabled: true },
});
```

To track a click, add `data-analytics-category` and `data-analytics-action` to a link or button. Calling `attach()` again replaces the tracking configuration. Call `analytics.detach()` when the app stops.
