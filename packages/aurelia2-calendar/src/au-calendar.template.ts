const template = `
<template>
  <style>
    .cv-wrapper {
      --cv-border: #e5e7eb;
      --cv-bg: #ffffff;
      --cv-muted: #6b7280;
      --cv-accent: #2563eb;
      --cv-item-bg: #dbeafe;
      --cv-item-border: #93c5fd;
      --cv-item-color: #1f2937;

      background: var(--cv-bg);
      border: 1px solid var(--cv-border);
      border-radius: 8px;
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #111827;
    }

    .cv-header,
    .cv-header-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .cv-header-title {
      font-weight: 600;
      min-width: 12rem;
      text-align: center;
    }

    .cv-nav {
      border: 1px solid var(--cv-border);
      background: #f9fafb;
      color: inherit;
      border-radius: 6px;
      padding: 0.35rem 0.6rem;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .cv-nav:hover,
    .cv-nav:focus-visible {
      border-color: var(--cv-accent);
      outline: none;
    }

    .cv-header-days {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 0.25rem;
      text-transform: uppercase;
      font-size: 0.75rem;
      color: var(--cv-muted);
    }

    .cv-header-day {
      text-align: center;
      padding: 0.25rem 0;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .cv-weeks {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .cv-week {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0.25rem;
    }

    .cv-weekdays {
      position: relative;
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      grid-auto-rows: minmax(5.25rem, auto);
      gap: 0.25rem;
    }

    .cv-day {
      position: relative;
      border: 1px solid var(--cv-border);
      border-radius: 6px;
      padding: 0.25rem;
      background: #fff;
      min-height: 5.25rem;
      overflow: hidden;
      cursor: pointer;
    }

    .cv-day.today {
      border-color: var(--cv-accent);
      box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.2);
    }

    .cv-day.outsideOfMonth {
      background: #f9fafb;
      color: var(--cv-muted);
    }

    .cv-day.selectionStart,
    .cv-day.selectionEnd,
    .cv-day.selectedDay,
    .cv-day[aria-selected="true"] {
      border-color: var(--cv-accent);
      background: rgba(37, 99, 235, 0.08);
    }

    .cv-day.selectedDay {
      box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.2);
    }

    .cv-day-number {
      font-size: 0.85rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-bottom: 0.25rem;
    }

    .cv-fom-name {
      font-size: 0.7rem;
      color: var(--cv-muted);
      font-weight: 500;
    }

    .cv-item {
      position: absolute;
      left: 0.25rem;
      right: 0.25rem;
      padding: 0.15rem 0.35rem;
      border-radius: 6px;
      border: 1px solid var(--cv-item-border);
      background: var(--cv-item-bg);
      color: var(--cv-item-color);
      font-size: 0.75rem;
      line-height: 1.2;
      text-decoration: none;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cv-item:hover,
    .cv-item:focus-visible {
      border-color: var(--cv-accent);
      outline: none;
    }

    .cv-item.span1 { width: calc((100% / 7) * 1 - 0.5rem); }
    .cv-item.span2 { width: calc((100% / 7) * 2 - 0.5rem); }
    .cv-item.span3 { width: calc((100% / 7) * 3 - 0.5rem); }
    .cv-item.span4 { width: calc((100% / 7) * 4 - 0.5rem); }
    .cv-item.span5 { width: calc((100% / 7) * 5 - 0.5rem); }
    .cv-item.span6 { width: calc((100% / 7) * 6 - 0.5rem); }
    .cv-item.span7 { width: calc((100% / 7) * 7 - 0.5rem); }

    .cv-item.offset0 { margin-left: calc((100% / 7) * 0); }
    .cv-item.offset1 { margin-left: calc((100% / 7) * 1); }
    .cv-item.offset2 { margin-left: calc((100% / 7) * 2); }
    .cv-item.offset3 { margin-left: calc((100% / 7) * 3); }
    .cv-item.offset4 { margin-left: calc((100% / 7) * 4); }
    .cv-item.offset5 { margin-left: calc((100% / 7) * 5); }
    .cv-item.offset6 { margin-left: calc((100% / 7) * 6); }
  </style>

  <div aria-label="Calendar" class.bind="wrapperClassList">
    <au-slot name="header" expose.bind="{ headerProps: headerProps, calendar: $this }">
      <div class="cv-header">
        <button type="button" class="cv-nav prev" click.trigger="previousPeriod()">Prev</button>
        <div class="cv-header-title">\${periodLabel}</div>
        <button type="button" class="cv-nav next" click.trigger="nextPeriod()">Next</button>
      </div>
      <div class="cv-header-actions">
        <button type="button" class="cv-nav today" click.trigger="goToToday()">Today</button>
      </div>
    </au-slot>

    <div class="cv-header-days">
      <div if.bind="displayWeekNumbers" class="cv-weeknumber"></div>
      <template repeat.for="header of dayHeaders">
        <au-slot name="day-header" expose.bind="header">
          <div class="cv-header-day \${header.className}">\${header.label}</div>
        </au-slot>
      </template>
    </div>

    <div class="cv-weeks" aria-multiselectable.bind="enableDateSelection">
      <template repeat.for="week of weeks">
        <div class="cv-week week\${$index + 1} ws\${week.isoStart}">
          <div if.bind="displayWeekNumbers" class="cv-weeknumber">
            <au-slot
              name="week-number"
              expose.bind="{ date: week.start, numberInYear: week.weekNumber, numberInPeriod: $index + 1 }"
            >
              <span>\${week.weekNumber}</span>
            </au-slot>
          </div>

          <div class="cv-weekdays">
            <template repeat.for="day of week.days">
              <div
                class.bind="day.classList"
                draggable.bind="enableDateSelection"
                aria-label.bind="day.date.getDate().toString()"
                aria-selected.bind="day.ariaSelected"
                click.trigger="onClickDay(day, $event)"
              >
                <div class="cv-day-number">
                  <span if.bind="day.monthLabel" class="cv-fom-name">\${day.monthLabel}</span>
                  \${day.date.getDate()}
                </div>
                <au-slot name="day-content" expose.bind="{ day: day.date }"></au-slot>
              </div>
            </template>

            <template repeat.for="item of week.items">
              <au-slot name="item" expose.bind="{ value: item.raw, weekStartDate: week.start, top: item.top }">
                <a
                  if.bind="item.url"
                  class.bind="item.classList"
                  href.bind="item.url"
                  rel="noopener noreferrer"
                  target="_blank"
                  title.bind="item.tooltip"
                  style.bind="item.style"
                  click.trigger="onClickItem(item, $event)"
                >
                  \${item.title}
                </a>
                <div
                  else
                  class.bind="item.classList"
                  role="button"
                  tabindex="0"
                  title.bind="item.tooltip"
                  style.bind="item.style"
                  click.trigger="onClickItem(item, $event)"
                >
                  \${item.title}
                </div>
              </au-slot>
            </template>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

`;
export default template;
