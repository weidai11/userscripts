# Power Reader: Karma & Color Behavior

This document describes how comment colors are calculated in Power Reader, matching the original old_power_reader.js behavior.

## Two Color Systems

### 1. Pink Background (Karma Score)

Applied to `.pr-comment-meta` based on normalized karma score.

**Age-based expected points:**
| Comment Age | Expected Points |
|-------------|-----------------|
| < 2 hours   | 2               |
| < 6 hours   | 3               |
| < 24 hours  | 4               |
| ≥ 24 hours  | 5               |

**Normalized score formula:**
```
normalizedScore = (actualPoints - 1) / (expectedPoints - 1)
```

- Score of 0 = 1 karma (baseline, white)
- Score of 1 = karma equal to expected points (light pink)
- Score > 1 = high karma (stronger pink)
- Score < 0 = negative karma (potentially auto-hidden)

**Author preference adjustment:**
```
normalizedScore += authorPreference * 0.52
```
Where `authorPreference` is +1, 0, or -1 based on user's [↑]/[↓] clicks.

**Color interpolation:**
```
backgroundColor = interpolate(#FFFFFF → #FFDDDD, clamp(normalizedScore, 0, 1))
```

### 2. Yellow Background (Recency)

Applied to entire `.pr-comment` based on global recency order.

**Order calculation:**
- Comments are sorted globally by date (newest first)
- First N comments get `order` values 1 to N (where N = `highlightLastN`, typically 33)
- Older comments get `order = 0` (no yellow)

**Color interpolation:**
```
if (order > 0) {
  backgroundColor = interpolate(#FFFFFE → #FFFFE0, (highlightLastN - order) / highlightLastN)
}
```
- `order = 1` (newest) → strongest yellow
- `order = N` → faintest yellow
- `order = 0` → no yellow

## Visual Effects Combined

When both pink and yellow apply:
- Yellow is applied to the comment container background
- Pink is applied to the comment meta (header) background
- Both are visible, with pink overlaying yellow in the header area

## Why Replies Appear "Stronger" Than Parents

| Factor | Parent (older) | Reply (newer) |
|--------|---------------|---------------|
| Age | Higher | Lower |
| Expected points | Higher (e.g., 4) | Lower (e.g., 2) |
| Normalized score | Lower | **Higher** → stronger pink |
| Global order | Higher or none | Lower → **stronger yellow** |

This is **intentional design** - newer comments should stand out to draw attention.

## Auto-Hide Threshold

Comments with `normalizedScore < -0.51` are automatically collapsed (hidden).

## Font Size Scaling

Font size scales with karma:
```
fontSize = Math.round((Math.min(points, 10) / 20 + 1) * 100) + '%'
```
- 0 karma → 100%
- 5 karma → 125%
- 10+ karma → 150%

## Reply-to-You Indicator

Comments replying to the logged-in user get a red border:
```css
border: 2px solid red;
```

## Read State

Previously-read comments:
- Text color: `#707070` (grey)
- No border
- Pink/yellow highlighting removed
