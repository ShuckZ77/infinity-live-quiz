# youtubei.js - Complete Feature Reference

A comprehensive guide to all features and capabilities of the `youtubei.js` library.

**Official Resources:**
- GitHub: https://github.com/LuanRT/YouTube.js
- Documentation: https://ytjs.dev
- API Reference: https://ytjs.dev/api/

---

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [All Features by Category](#all-features-by-category)
- [Platform Interfaces](#platform-interfaces)
- [Code Examples](#code-examples)
- [Advanced Features](#advanced-features)

---

## Overview

`youtubei.js` (also called YouTube.js) is a JavaScript client for YouTube's **private InnerTube API**. This is the same API that YouTube's website, mobile apps, and TV apps use internally.

### Why Use youtubei.js?

| Feature | Official YouTube API | youtubei.js |
|---------|---------------------|-------------|
| API Key Required | Yes | No |
| Rate Limits | Strict quotas | More lenient |
| Video Download | Not supported | Supported |
| Live Chat Access | Limited | Full access |
| Comment Posting | OAuth required | Cookie auth |
| Private Data | Limited | Full access |

### Platform Support

- Node.js (v16.8+)
- Deno
- Modern Browsers (with bundler)

---

## Installation

```bash
# NPM
npm install youtubei.js@latest

# Yarn
yarn add youtubei.js@latest

# Deno
deno add npm:youtubei.js@latest

# Edge version (latest from GitHub)
npm install github:LuanRT/YouTube.js
```

---

## Core Concepts

### 1. Innertube Client

The main entry point for all operations:

```javascript
const { Innertube } = require('youtubei.js');

const yt = await Innertube.create({
  cache: new UniversalCache(false),
  generate_session_locally: true,
  client_type: 'WEB',
});
```

### 2. Client Types

Different client types for different use cases:

| Client Type | Use Case |
|-------------|----------|
| `WEB` | Standard YouTube website (most stable) |
| `ANDROID` | Android app features |
| `IOS` | iOS app features |
| `TV_EMBEDDED` | Smart TV interface |
| `YTMUSIC` | YouTube Music web |
| `YTMUSIC_ANDROID` | YouTube Music Android |
| `YTKIDS` | YouTube Kids |

### 3. Authentication

```javascript
// Cookie-based authentication
const yt = await Innertube.create({
  cookie: 'YOUR_YOUTUBE_COOKIES',
});

// OAuth2 authentication
const yt = await Innertube.create();
yt.session.on('auth-pending', (data) => {
  console.log(`Go to ${data.verification_url} and enter code: ${data.user_code}`);
});
await yt.session.signIn();
```

---

## All Features by Category

### Video Information

| Method | Description |
|--------|-------------|
| `getInfo(videoId)` | Get comprehensive video data (metadata, streams, chapters, etc.) |
| `getBasicInfo(videoId)` | Get basic video details (faster than getInfo) |
| `getShortsVideoInfo(videoId)` | Get info for YouTube Shorts |
| `getStreamingData(videoId)` | Get deciphered streaming URLs |

```javascript
// Get full video info
const info = await yt.getInfo('dQw4w9WgXcQ');
console.log(info.basic_info.title);
console.log(info.basic_info.view_count);
console.log(info.basic_info.duration);
console.log(info.basic_info.is_live);

// Access streaming formats
const formats = info.streaming_data.formats;
const adaptiveFormats = info.streaming_data.adaptive_formats;
```

---

### Video Download

| Method | Description |
|--------|-------------|
| `download(videoId, options)` | Download video as stream |
| `VideoInfo#download(options)` | Download from video info object |
| `toDash()` | Convert to MPEG-DASH manifest |

```javascript
// Download video
const stream = await yt.download('dQw4w9WgXcQ', {
  type: 'video+audio',  // 'video', 'audio', or 'video+audio'
  quality: 'best',      // 'best', 'bestefficiency', or specific itag
  format: 'mp4',
});

// Pipe to file
const fs = require('fs');
stream.pipe(fs.createWriteStream('video.mp4'));

// Or from video info
const info = await yt.getInfo('dQw4w9WgXcQ');
const stream = await info.download({
  type: 'audio',
  quality: 'best',
  format: 'mp3',
});
```

---

### Search

| Method | Description |
|--------|-------------|
| `search(query, filters?)` | Search YouTube |
| `getSearchSuggestions(query)` | Get autocomplete suggestions |

```javascript
// Basic search
const results = await yt.search('lofi hip hop');
console.log(results.videos);  // Video results
console.log(results.playlists);  // Playlist results
console.log(results.channels);  // Channel results

// Search with filters
const results = await yt.search('lofi', {
  type: 'video',           // 'video', 'channel', 'playlist', 'movie'
  duration: 'long',        // 'short', 'medium', 'long'
  upload_date: 'week',     // 'hour', 'today', 'week', 'month', 'year'
  sort_by: 'view_count',   // 'relevance', 'rating', 'upload_date', 'view_count'
  features: ['live', 'hd'], // 'live', '4k', 'hd', 'subtitles', 'creative_commons', '360', 'vr180', '3d', 'hdr', 'location', 'purchased'
});

// Filter for live streams only
const liveStream = results.videos.find(v => v.is_live);

// Get search suggestions
const suggestions = await yt.getSearchSuggestions('lofi');
console.log(suggestions);  // ['lofi hip hop', 'lofi girl', ...]

// Pagination
const nextPage = await results.getContinuation();
```

---

### Comments

| Method | Description |
|--------|-------------|
| `getComments(videoId)` | Get video comments |
| `getPostComments(postId)` | Get community post comments |

```javascript
// Get comments
const comments = await yt.getComments('dQw4w9WgXcQ');

for (const comment of comments.contents) {
  console.log(comment.author.name);
  console.log(comment.content.text);
  console.log(comment.vote_count);
  console.log(comment.reply_count);
}

// Get replies to a comment
const thread = comments.contents[0];
const replies = await thread.getReplies();

// Load more comments
const moreComments = await comments.getContinuation();

// Post a comment (requires auth)
await yt.interact.comment(videoId, 'Great video!');
```

---

### Live Chat

| Method | Description |
|--------|-------------|
| `info.getLiveChat()` | Get LiveChat instance from video info |
| `livechat.on('chat-update', cb)` | Listen for new messages |
| `livechat.on('update-metadata', cb)` | Listen for viewer count updates |
| `livechat.sendMessage(text)` | Send chat message (requires auth) |

```javascript
// Get video info first
const info = await yt.getInfo('LIVE_VIDEO_ID');

// Get live chat instance
const livechat = info.getLiveChat();

// Listen for new messages
livechat.on('chat-update', (action) => {
  if (action.type === 'AddChatItemAction') {
    const message = action.item;
    console.log(`${message.author.name}: ${message.message.text}`);
  }
});

// Listen for metadata updates (viewer count, etc.)
livechat.on('update-metadata', (data) => {
  console.log(`Viewers: ${data.viewership.view_count}`);
});

// Start receiving messages
livechat.start();

// Send a message (requires authentication)
await livechat.sendMessage('Hello everyone!');

// Stop listening
livechat.stop();
```

**Alternative: Custom Polling (Lower Latency)**

```javascript
// Direct API call for lower latency
const response = await yt.actions.execute('live_chat/get_live_chat', {
  continuation: info.livechat.continuation,
  parse: true,
});

const messages = response.continuation_contents.actions;
```

---

### Playlists

| Method | Description |
|--------|-------------|
| `getPlaylist(playlistId)` | Get playlist contents |
| `getPlaylists()` | Get user's playlists (requires auth) |
| `playlist.create(title, videoIds)` | Create playlist (requires auth) |
| `playlist.delete(playlistId)` | Delete playlist (requires auth) |
| `playlist.addVideos(playlistId, videoIds)` | Add videos to playlist |
| `playlist.removeVideos(playlistId, videoIds)` | Remove videos from playlist |

```javascript
// Get playlist contents
const playlist = await yt.getPlaylist('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
console.log(playlist.info.title);
console.log(playlist.info.total_items);

for (const video of playlist.items) {
  console.log(video.title);
  console.log(video.duration);
}

// Pagination
const nextPage = await playlist.getContinuation();

// Create a playlist (requires auth)
await yt.playlist.create('My Playlist', ['videoId1', 'videoId2']);

// Add videos to playlist
await yt.playlist.addVideos('playlistId', ['videoId3', 'videoId4']);
```

---

### Channels

| Method | Description |
|--------|-------------|
| `getChannel(channelId)` | Get channel info and content |
| `channel.getVideos()` | Get channel's videos |
| `channel.getShorts()` | Get channel's Shorts |
| `channel.getPlaylists()` | Get channel's playlists |
| `channel.getCommunity()` | Get community posts |
| `channel.getAbout()` | Get channel about info |

```javascript
// Get channel
const channel = await yt.getChannel('UC-lHJZR3Gqxm24_Vd_AJ5Yw');  // PewDiePie
console.log(channel.header.author.name);
console.log(channel.header.subscriber_count);

// Get channel videos
const videos = await channel.getVideos();

// Get channel Shorts
const shorts = await channel.getShorts();

// Get channel playlists
const playlists = await channel.getPlaylists();

// Get community posts
const community = await channel.getCommunity();

// Subscribe to channel (requires auth)
await yt.interact.subscribe(channelId);
```

---

### Home Feed & Discovery

| Method | Description |
|--------|-------------|
| `getHomeFeed()` | Get YouTube homepage content |
| `getTrending()` | Get trending videos |
| `getHashtag(tag)` | Get hashtag page |
| `getGuide()` | Get sidebar guide |

```javascript
// Get home feed
const home = await yt.getHomeFeed();
for (const video of home.videos) {
  console.log(video.title);
}

// Get trending
const trending = await yt.getTrending();

// Get trending by category
const trendingMusic = await yt.getTrending('Music');
const trendingGaming = await yt.getTrending('Gaming');

// Get hashtag feed
const hashtag = await yt.getHashtag('lofi');
```

---

### User Library & History

| Method | Description |
|--------|-------------|
| `getHistory()` | Get watch history (requires auth) |
| `getLibrary()` | Get library content (requires auth) |
| `getSubscriptionsFeed()` | Get subscriptions feed (requires auth) |
| `getChannelsFeed()` | Get subscribed channels (requires auth) |

```javascript
// Get watch history
const history = await yt.getHistory();
for (const video of history.videos) {
  console.log(video.title);
}

// Get library
const library = await yt.getLibrary();

// Get subscriptions feed
const subscriptions = await yt.getSubscriptionsFeed();

// Get list of subscribed channels
const channels = await yt.getChannelsFeed();
```

---

### Notifications

| Method | Description |
|--------|-------------|
| `getNotifications()` | Get notifications menu (requires auth) |
| `getUnseenNotificationsCount()` | Get unseen count (requires auth) |

```javascript
// Get notifications
const notifications = await yt.getNotifications();

// Get unseen count
const count = await yt.getUnseenNotificationsCount();
console.log(`You have ${count} new notifications`);
```

---

### Interactions

| Method | Description |
|--------|-------------|
| `interact.like(videoId)` | Like a video |
| `interact.dislike(videoId)` | Dislike a video |
| `interact.removeLike(videoId)` | Remove like/dislike |
| `interact.subscribe(channelId)` | Subscribe to channel |
| `interact.unsubscribe(channelId)` | Unsubscribe from channel |
| `interact.comment(videoId, text)` | Post a comment |
| `interact.setNotificationPreferences(channelId, type)` | Set notification preference |

```javascript
// Like a video
await yt.interact.like('dQw4w9WgXcQ');

// Subscribe to a channel
await yt.interact.subscribe('UC-lHJZR3Gqxm24_Vd_AJ5Yw');

// Post a comment
await yt.interact.comment('dQw4w9WgXcQ', 'Great video!');

// Set notification preferences
await yt.interact.setNotificationPreferences(channelId, 'ALL'); // 'ALL', 'NONE', 'PERSONALIZED'
```

---

### Account Management

| Method | Description |
|--------|-------------|
| `account.getInfo()` | Get account info |
| `account.getTimeWatched()` | Get watch time stats |
| `account.getAnalytics()` | Get channel analytics (creators) |

```javascript
// Get account info
const account = await yt.account.getInfo();
console.log(account.name);
console.log(account.email);

// Get watch time
const watchTime = await yt.account.getTimeWatched();
```

---

### Community Posts

| Method | Description |
|--------|-------------|
| `getPost(postId)` | Get a community post |
| `getPostComments(postId)` | Get comments on a post |

```javascript
// Get a post
const post = await yt.getPost('Ugkx...');

// Get post comments
const comments = await yt.getPostComments('Ugkx...');
```

---

## Platform Interfaces

### YouTube Music (`yt.music`)

```javascript
// Search music
const results = await yt.music.search('lofi beats', { type: 'song' });

// Get song info
const song = await yt.music.getInfo('videoId');

// Get lyrics
const lyrics = await song.getLyrics();

// Get related songs
const related = await song.getRelated();

// Get album
const album = await yt.music.getAlbum('albumId');

// Get artist
const artist = await yt.music.getArtist('artistId');

// Get playlist
const playlist = await yt.music.getPlaylist('playlistId');

// Get home feed
const home = await yt.music.getHomeFeed();

// Get explore page
const explore = await yt.music.getExplore();

// Get library (requires auth)
const library = await yt.music.getLibrary();

// Search suggestions
const suggestions = await yt.music.getSearchSuggestions('lofi');
```

---

### YouTube Kids (`yt.kids`)

```javascript
// Get home feed
const home = await yt.kids.getHomeFeed();

// Search (kid-safe content only)
const results = await yt.kids.search('peppa pig');

// Get video info
const info = await yt.kids.getInfo('videoId');

// Get channel
const channel = await yt.kids.getChannel('channelId');
```

---

### YouTube Studio (`yt.studio`)

For channel creators/managers:

```javascript
// Get channel analytics
const analytics = await yt.studio.getAnalytics();

// Get video analytics
const videoAnalytics = await yt.studio.getVideoAnalytics('videoId');

// Update video details
await yt.studio.updateVideoMetadata('videoId', {
  title: 'New Title',
  description: 'New description',
  tags: ['tag1', 'tag2'],
});
```

---

## Advanced Features

### Direct API Calls

```javascript
// Execute any InnerTube endpoint directly
const response = await yt.actions.execute('/browse', {
  browseId: 'FEwhat_to_watch',
  parse: true,
});
```

### URL Resolution

```javascript
// Convert any YouTube URL to a navigation endpoint
const endpoint = await yt.resolveURL('https://youtube.com/watch?v=dQw4w9WgXcQ');
console.log(endpoint.payload.videoId);
```

### Caching

```javascript
const { Innertube, UniversalCache } = require('youtubei.js');

// Enable caching
const yt = await Innertube.create({
  cache: new UniversalCache(true),  // Uses default cache directory
});

// Custom cache directory
const yt = await Innertube.create({
  cache: new UniversalCache(true, './my-cache'),
});
```

### Proxy Support

```javascript
const yt = await Innertube.create({
  fetch: async (input, init) => {
    // Use your proxy here
    return fetch(input, {
      ...init,
      agent: new ProxyAgent('http://proxy:8080'),
    });
  },
});
```

### Device & Location Settings

```javascript
const yt = await Innertube.create({
  location: 'US',           // Country code
  language: 'en',           // Language code
  device_category: 'DESKTOP', // 'DESKTOP' or 'MOBILE'
  client_type: 'WEB',
  enable_safety_mode: false,
});
```

---

## Response Parsing

The library automatically parses YouTube's complex responses:

```javascript
const info = await yt.getInfo('videoId');

// Parsed data structure
info.basic_info.title
info.basic_info.description
info.basic_info.view_count
info.basic_info.like_count
info.basic_info.duration
info.basic_info.is_live
info.basic_info.is_upcoming
info.basic_info.channel.name
info.basic_info.channel.id

// Streaming data
info.streaming_data.formats
info.streaming_data.adaptive_formats
info.streaming_data.dash_manifest_url
info.streaming_data.hls_manifest_url

// Related videos
info.watch_next_feed

// Chapters
info.chapters

// Captions/Subtitles
info.captions.caption_tracks
```

---

## Error Handling

```javascript
try {
  const info = await yt.getInfo('invalidId');
} catch (error) {
  if (error.message.includes('Video unavailable')) {
    console.log('Video is private or deleted');
  } else if (error.message.includes('Sign in')) {
    console.log('Authentication required');
  } else if (error.message.includes('Live Chat is not available')) {
    console.log('Chat disabled or stream ended');
  }
}
```

---

## Comparison with Official API

| Feature | Official API | youtubei.js |
|---------|-------------|-------------|
| Search videos | Yes | Yes |
| Video metadata | Yes | Yes |
| Comments (read) | Yes | Yes |
| Comments (write) | OAuth | Cookie/OAuth |
| Live chat | Limited | Full |
| Video download | No | Yes |
| Watch history | No | Yes |
| Subscriptions | OAuth | Cookie/OAuth |
| No API key | No | Yes |
| Rate limits | Strict | Lenient |
| YouTube Music | No | Yes |
| YouTube Kids | No | Yes |

---

## Resources

- **GitHub Repository**: https://github.com/LuanRT/YouTube.js
- **Documentation**: https://ytjs.dev/guide/getting-started
- **API Reference**: https://ytjs.dev/api/classes/Innertube
- **NPM Package**: https://www.npmjs.com/package/youtubei.js

---

## License

youtubei.js is released under the MIT License.
