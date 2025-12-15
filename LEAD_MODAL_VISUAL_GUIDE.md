# Lead Details Modal - Visual Guide

## Layout Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Lead Details                                                          [X]    │
├──────────────────────┬──────────────────────────────────────────────────────┤
│                      │                                                      │
│  LEFT PANEL (380px)  │         RIGHT PANEL (Flexible)                      │
│                      │                                                      │
│  ┌────────────────┐  │  ┌────────────────────────────────────────────────┐ │
│  │ [Avatar] Name  │  │  │ [Activities] [Conversation History]            │ │
│  │ email@test.com │  │  ├────────────────────────────────────────────────┤ │
│  │ LinkedIn Link  │  │  │                                                │ │
│  │ [Status] [Type]│  │  │  Content Area (Scrollable)                     │ │
│  └────────────────┘  │  │                                                │ │
│                      │  │  - Timeline view for Activities                │ │
│  Lead Information    │  │  - Message cards for Conversation              │ │
│  ├─ Assigned SDR     │  │                                                │ │
│  ├─ Pipeline Stage   │  │                                                │ │
│  ├─ Company          │  │                                                │ │
│  ├─ Location         │  │                                                │ │
│  ├─ Last Contact     │  │                                                │ │
│  └─ Stage Assigned   │  │                                                │ │
│                      │  │                                                │ │
│  Subject             │  │                                                │ │
│  [Email subject...]  │  │                                                │ │
│                      │  │                                                │ │
│  Received On         │  │                                                │ │
│  [Account details]   │  │                                                │ │
│                      │  └────────────────────────────────────────────────┘ │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

## Left Panel - Lead Information

### Header Section
```
┌──────────────────────────────────┐
│  ┌────┐                          │
│  │ JD │  John Doe                │
│  └────┘  john@example.com        │
│          🔗 View LinkedIn Profile │
│                                   │
│  [new] [📧 Email]                │
└──────────────────────────────────┘
```

### Information Grid
```
┌──────────────────────────────────┐
│ Lead Information                  │
│                                   │
│ 👤 Assigned SDR                  │
│    Sarah Johnson                  │
│                                   │
│ 📋 Pipeline Stage                │
│    Qualified                      │
│                                   │
│ 🏢 Company                       │
│    Acme Corporation              │
│                                   │
│ 📍 Location                      │
│    San Francisco, CA             │
│                                   │
│ 🕐 Last Contact                  │
│    2 hours ago                   │
│                                   │
│ 📅 Stage Assigned                │
│    Dec 15, 2025                  │
└──────────────────────────────────┘
```

## Right Panel - Activities Tab

### Timeline View
```
┌────────────────────────────────────────────────────────────┐
│ Activities                                                  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ⭕ Message received from John Doe        2 hours ago      │
│  │  "Thank you for reaching out..."                        │
│  │  Dec 15, 2025 • 3:45 PM                               │
│  │                                                          │
│  ⭕ Stage changed to "Qualified"          5 hours ago      │
│  │  Moved to Qualified stage                               │
│  │  Dec 15, 2025 • 12:30 PM                              │
│  │                                                          │
│  ⭕ Assigned to Sarah Johnson             1 day ago        │
│  │  SDR: Sarah Johnson                                     │
│  │  Dec 14, 2025 • 10:15 AM                              │
│  │                                                          │
│  ⭕ Lead created from Email                2 days ago      │
│  │  Initial contact received                               │
│  │  Dec 13, 2025 • 9:00 AM                               │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

## Right Panel - Conversation History Tab

### Message Cards
```
┌────────────────────────────────────────────────────────────┐
│ Conversation History                                        │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ [JD] John Doe                      [Received]        │ │
│  │      Dec 15, 2025 • 3:45 PM                         │ │
│  │                                                       │ │
│  │ Thank you for reaching out. I'm very interested      │ │
│  │ in learning more about your product. Could we        │ │
│  │ schedule a call next week?                           │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ [SJ] Sarah Johnson                 [Sent]            │ │
│  │      Dec 14, 2025 • 2:30 PM                         │ │
│  │                                                       │ │
│  │ Hi John, I wanted to follow up on our previous      │ │
│  │ conversation. Are you still interested in our        │ │
│  │ solution?                                            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ [JD] John Doe                      [Received]        │ │
│  │      Dec 13, 2025 • 9:00 AM                         │ │
│  │                                                       │ │
│  │ Hello, I saw your product demo and I'm interested    │ │
│  │ in learning more about pricing and features.         │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

## Color Scheme

### Status Badges
- **new**: Blue background, blue text
- **engaged**: Purple background, purple text
- **qualified**: Amber background, amber text
- **converted**: Green background, green text
- **not_interested**: Red background, red text

### Message Cards
- **Received messages**: Light gray background, standard border
- **Sent messages**: Light primary color background, primary border

### Activity Icons
- All icons use primary color
- Icons are contained in circular backgrounds
- Timeline connector uses border color

## Responsive Behavior

### Modal Size
- **Width**: 6xl (max-width: 72rem / 1152px)
- **Height**: 90vh (90% of viewport height)
- **Minimum**: Ensures content is readable on smaller screens

### Scrolling
- **Left Panel**: Scrollable when content exceeds height
- **Right Panel**: Each tab content is independently scrollable
- **Smooth scrolling**: Native browser smooth scroll

### Empty States
- **No Activities**: Clock icon with "No activities yet" message
- **No Messages**: Mail icon with "No messages in this conversation yet"

## Interaction States

### Tabs
- **Active tab**: Primary color underline and text
- **Inactive tab**: Muted text color
- **Hover**: Slight background color change

### Links
- **LinkedIn Profile**: Blue text with underline on hover
- **External links**: Open in new tab (target="_blank")

### Badges
- **Status**: Color-coded with subtle background
- **Channel**: Outline style with icon

## Accessibility

### Keyboard Navigation
- Tab through all interactive elements
- Enter/Space to activate buttons and tabs
- Escape to close modal

### Screen Readers
- Proper ARIA labels on all interactive elements
- Semantic HTML structure
- Alt text for icons and images

### Focus Management
- Clear focus indicators
- Focus trapped within modal when open
- Returns focus to trigger element on close

## Performance

### Data Loading
- Messages fetched when modal opens
- Real-time updates every 5 seconds
- Optimistic UI updates for better UX

### Rendering
- Virtualized scrolling for long lists (future enhancement)
- Memoized components to prevent unnecessary re-renders
- Lazy loading of heavy content

## Future Enhancements

### Inline Editing
```
┌──────────────────────────────────┐
│ 👤 Assigned SDR         [Edit]   │
│    Sarah Johnson                  │
│                                   │
│ 📋 Pipeline Stage       [Edit]   │
│    Qualified                      │
└──────────────────────────────────┘
```

### Quick Actions
```
┌──────────────────────────────────┐
│ Quick Actions                     │
│ [📝 Add Note] [📎 Attach File]  │
│ [📞 Log Call] [✉️ Send Email]   │
└──────────────────────────────────┘
```

### Email Thread View
```
┌────────────────────────────────────┐
│ 📧 Email Thread (5 messages)      │
│ ├─ RE: Product Inquiry            │
│ ├─ RE: RE: Product Inquiry        │
│ └─ RE: RE: RE: Product Inquiry    │
└────────────────────────────────────┘
```
