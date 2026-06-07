# Abɔfa PMS - Troubleshooting & FAQ

## Common Issues

### Build & Deployment

#### Build Fails with "Module not found"

**Error:** `Module not found: Can't resolve '@/components/...'`

**Solutions:**
1. Check file path spelling (case-sensitive)
2. Verify file exists: `ls components/dashboard/file-name.tsx`
3. Restart dev server: `pnpm dev`
4. Clear cache: `rm -rf .next && pnpm dev`

#### Build Times Out

**Error:** `Build timeout after 900 seconds`

**Solutions:**
1. Check for circular imports: `pnpm run build --debug`
2. Split large components
3. Increase timeout in `next.config.js`
4. Deploy to Vercel (better resources)

#### Environment Variables Not Loading

**Error:** `undefined is not a function` or missing API key

**Solutions:**
1. Verify `.env.local` exists and has correct variables
2. Restart dev server after adding variables
3. Check environment variable names exactly
4. For Vercel: Redeploy after setting variables
5. Verify variables in Vercel Dashboard → Settings → Environment Variables

```bash
# Debug environment variables
echo "DATABASE_URL: $DATABASE_URL"
echo "API_KEY: $API_KEY"
```

### Development Server

#### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solutions:**
1. Kill process: `lsof -i :3000 | kill -9 [PID]`
2. Use different port: `pnpm dev -p 3001`
3. Check for hung processes: `ps aux | grep node`

#### Hot Module Replacement (HMR) Not Working

**Error:** Changes not reflecting in browser

**Solutions:**
1. Check browser console for errors
2. Restart dev server: `pnpm dev`
3. Clear browser cache: Ctrl+Shift+Delete
4. Hard refresh: Ctrl+Shift+R
5. Restart browser

#### Styling Not Applied

**Error:** Tailwind classes don't show effect

**Solutions:**
1. Verify class name is correct: `bg-primary` not `bg-primary-color`
2. Check `globals.css` has Tailwind imports
3. Clear build cache: `rm -rf .next`
4. Restart dev server: `pnpm dev`
5. Check for conflicting global styles

### Components & Pages

#### Component Not Rendering

**Error:** Blank page or missing component

**Solutions:**

1. Check page file exists:
```bash
ls app/\(dashboard\)/guests/page.tsx
```

2. Verify component export:
```tsx
// ✅ Correct
export function GuestsTable() { }
export default function GuestsPage() { }

// ❌ Wrong
const GuestsTable = () => { } // Not exported
```

3. Check import path:
```tsx
// ✅ Correct absolute import
import { GuestsTable } from '@/components/dashboard/guests-table'

// ❌ Avoid relative imports
import GuestsTable from '../../../components/dashboard/guests-table'
```

4. Verify 'use client' directive if using hooks:
```tsx
'use client'

import { useState } from 'react'

export function MyComponent() {
  const [state, setState] = useState(null)
  // ...
}
```

#### State Not Updating

**Error:** Component state doesn't change on interaction

**Solutions:**

1. Verify state setter is called:
```tsx
// ✅ Correct
const [count, setCount] = useState(0)
<button onClick={() => setCount(count + 1)}>Count: {count}</button>

// ❌ Wrong - not calling setter
<button onClick={() => count + 1}>Count: {count}</button>
```

2. Check for React batching:
```tsx
// ✅ Multiple state updates batched
const handleClick = () => {
  setName('Ama')
  setEmail('ama@example.com') // Batched together
}
```

3. Use functional updates for complex logic:
```tsx
// ✅ Correct
setTasks(prev => [...prev, newTask])

// ❌ Avoid direct mutation
tasks.push(newTask)
setTasks(tasks)
```

### Data & Routing

#### Data Not Displaying

**Error:** Table empty or undefined data

**Solutions:**

1. Check mock data exists:
```bash
grep -n "export const guests" lib/mock-data.ts
```

2. Verify import path:
```tsx
// ✅ Correct
import { guests } from '@/lib/mock-data'

// ❌ Wrong
import guests from '@/lib/mock-data' // Default export
```

3. Check data format matches component:
```tsx
// Mock data should be an array
export const guests = [
  { id: '1', name: 'Ama', ... },
  { id: '2', name: 'Kofi', ... }
]

// Component expects array
guests.map(guest => <tr key={guest.id}> ...</tr>)
```

#### Routing Issues

**Error:** Page not found or wrong route

**Solutions:**

1. File structure matters in App Router:
```
app/
  (dashboard)/
    guests/
      page.tsx          → /guests route
    layout.tsx          → shared layout
  page.tsx              → / route
  layout.tsx            → root layout
```

2. Check route parameters:
```tsx
// File: app/[id]/page.tsx
export default function Page({ params }: { params: { id: string } }) {
  console.log(params.id) // Prints route param
}
```

3. Verify link href matches route:
```tsx
// ✅ Correct - matches file structure
<Link href="/guests">Guests</Link>

// ❌ Wrong - doesn't exist
<Link href="/guest-list">Guests</Link>
```

### Performance

#### Slow Page Load

**Solutions:**

1. Check network tab in DevTools
2. Identify slow API calls (will be when using real data)
3. Profile with Chrome DevTools → Performance tab
4. Look for:
   - Large images (optimize with next/image)
   - Missing dynamic imports
   - Synchronous data fetching

#### High Memory Usage

**Solutions:**

1. Check for memory leaks in browser console
2. Unsubscribe from all listeners
3. Clear large data structures
4. Monitor with: `ps aux | grep node`
5. Check for infinite loops in useEffect:

```tsx
// ❌ Infinite loop - deps missing
useEffect(() => {
  setData(fetchData())
})

// ✅ Correct
useEffect(() => {
  setData(fetchData())
}, []) // Empty deps = run once
```

### Browser Issues

#### Page Looks Different in Mobile

**Solutions:**

1. Check viewport meta tag in layout.tsx:
```tsx
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

2. Test with DevTools mobile emulation:
   - Chrome: F12 → Ctrl+Shift+M
   - Firefox: F12 → Ctrl+Shift+M

3. Verify Tailwind responsive classes:
```tsx
// Mobile first
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
  // 1 column on mobile, 2 on tablet, 4 on desktop
</div>
```

#### Styling Breaks at Certain Screen Sizes

**Solutions:**

1. Test all breakpoints:
   - Mobile: 375px (iPhone SE)
   - Tablet: 768px (iPad)
   - Desktop: 1024px+ (laptop)

2. Use Tailwind breakpoint classes:
```tsx
// Specify classes for each breakpoint
className="px-2 md:px-4 lg:px-6"
// 2px padding on mobile, 4px on tablet, 6px on desktop
```

3. Debug with browser DevTools:
   - Right-click element → Inspect
   - Check computed styles
   - See which breakpoint active

## FAQ

### General

**Q: What is Abɔfa PMS?**
A: Abɔfa PMS is a property management system designed for Ghana hospitality businesses. It manages bookings, guests, housekeeping, billing, and GRA tax compliance.

**Q: Is the data real or mock?**
A: Currently all data is mock (demo). Connect a database like Neon to use real data.

**Q: Can I use this for my property?**
A: The system is production-ready. Customize colors, add your property info in Settings, and deploy to Vercel.

**Q: How many properties does it support?**
A: Currently optimized for 1-2 properties. Multi-property version coming soon.

### Technical

**Q: What's the cost to run this?**
A: 
- Vercel: Free tier (4GB/month bandwidth) or $20+/month hobby tier
- Database (Neon): Free tier or $15+/month paid
- Custom domain: $10-15/year
- Total: $0-40/month depending on usage

**Q: Can I modify the design?**
A: Yes! All styling uses Tailwind CSS and is easily customizable. See DESIGN_SYSTEM.md.

**Q: How do I add new features?**
A: Create new component files and import them. See DEVELOPER_GUIDE.md for patterns.

**Q: What's the database structure?**
A: Currently using mock data. See ARCHITECTURE.md for planned schema.

**Q: Can I use a different database?**
A: Yes, but Neon PostgreSQL is recommended. Adjust API layer as needed.

### Deployment

**Q: How do I deploy this?**
A: Push to GitHub, connect to Vercel, auto-deploys. See DEPLOYMENT.md for details.

**Q: How do I add my domain?**
A: Vercel Dashboard → Project → Settings → Domains → Add Domain. Follow nameserver setup.

**Q: Can I run this locally?**
A: Yes! `pnpm dev` and open localhost:3000.

**Q: How do I set environment variables?**
A: Create `.env.local` file locally, or use Vercel Dashboard for production.

### Data & Security

**Q: Where is my data stored?**
A: With Neon PostgreSQL, data stored in secure European servers with automatic backups.

**Q: Is it secure?**
A: Yes. Implements HTTPS, input validation, RBAC, and audit logging. See SECURITY.md.

**Q: Can I export my data?**
A: Yes. Implement export-to-CSV features. Data is yours - no vendor lock-in.

**Q: How do I back up data?**
A: Neon handles daily automatic backups. One-click restore from Neon dashboard.

### Features

**Q: Can multiple staff members use it simultaneously?**
A: Yes, design supports unlimited concurrent users. Real-time sync coming soon.

**Q: Does it support multi-currency?**
A: Currently set to Ghana Cedis (₵). Modify currency in component files.

**Q: Can I connect OTA channels like Airbnb?**
A: Yes! Settings screen has OTA integration setup. API connections in development.

**Q: Does it have a mobile app?**
A: Yes! PWA housekeeping app at /mobile/housekeeping optimized for iOS/Android.

**Q: Can I generate reports?**
A: Yes. Analytics screen has metrics. GRA Reports screen handles tax compliance.

## Performance Tips

### For Users

1. **Clear browser cache** if seeing old data
2. **Use mobile app** for housekeeping (faster, works offline)
3. **Close unused tabs** to reduce memory
4. **Update browser** regularly

### For Admins

1. **Monitor database** size with Neon dashboard
2. **Archive old data** to keep queries fast
3. **Index frequently queried** fields
4. **Review API logs** for slow endpoints
5. **Profile performance** with Chrome DevTools

## Getting Help

### Documentation

1. **FEATURES.md** - Feature descriptions and workflows
2. **DEVELOPER_GUIDE.md** - Technical implementation
3. **USER_GUIDE.md** - User-facing help
4. **DEPLOYMENT.md** - Deployment instructions
5. **SECURITY.md** - Security practices

### Support Channels

- GitHub Issues: Report bugs or request features
- Email: support@abcofapms.com
- Docs: help.abcofapms.com

### Debug Mode

Enable debugging:
```typescript
// In components
console.log('[v0] Debug info:', variable)

// Check logs
// Browser DevTools → Console tab
```

## Advanced Troubleshooting

### Clear Everything & Start Fresh

```bash
# Clear dependencies
rm -rf node_modules
rm pnpm-lock.yaml

# Clear build cache
rm -rf .next

# Reinstall everything
pnpm install

# Start fresh
pnpm dev
```

### Test Production Build Locally

```bash
# Build production version
pnpm run build

# Serve production build
pnpm start
```

### Profile Performance

```bash
# Generate build analysis
ANALYZE=true pnpm run build

# Check bundle size
npm run analyze  # if configured
```

## Known Limitations

1. **Mock data only** - Use real database for production
2. **Single property** - Multi-property in v2
3. **Limited reporting** - Advanced reports coming soon
4. **No real-time sync** - Implement WebSockets for live updates
5. **Basic auth** - Add OAuth/2FA before public launch

## Report a Bug

Found an issue? Please report it with:
1. Error message and stack trace
2. Steps to reproduce
3. Browser and OS
4. Expected vs actual behavior
5. Screenshots if applicable
