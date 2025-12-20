## Complete Extension Implementation Plan

### Project Structure

```
raycast-weekly/
├── package.json
├── src/
│   ├── subscribe.ts
│   ├── browse-posts.tsx
│   ├── submit-content.tsx
│   ├── api/
│   │   └── substack.ts
│   ├── types/
│   │   └── post.ts
│   └── utils/
│       └── html-to-markdown.ts
```

---

### 1. Package Configuration

```json
{
  "name": "raycast-weekly",
  "title": "Raycast Weekly",
  "description": "Browse and interact with Raycast Weekly Substack newsletter",
  "icon": "extension-icon.png",
  "author": "your-name",
  "categories": ["Communication", "News"],
  "license": "MIT",
  "commands": [
    {
      "name": "subscribe",
      "title": "Subscribe to Raycast Weekly",
      "description": "Open the newsletter subscription page",
      "mode": "no-view"
    },
    {
      "name": "browse-posts",
      "title": "Browse Posts",
      "description": "List and read Raycast Weekly posts",
      "mode": "view"
    },
    {
      "name": "submit-content",
      "title": "Submit Content",
      "description": "Submit content ideas to Raycast Weekly",
      "mode": "view"
    }
  ],
  "dependencies": {
    "@raycast/api": "^1.93.0",
    "@raycast/utils": "^1.18.0",
    "node-html-markdown": "^1.3.0"
  },
  "devDependencies": {
    "@raycast/eslint-config": "^1.0.11",
    "@types/node": "22.14.0",
    "@types/react": "19.0.10",
    "eslint": "^8.57.0",
    "prettier": "^3.5.3",
    "typescript": "^5.8.2"
  },
  "scripts": {
    "build": "ray build --skip-types -e dist -o dist",
    "dev": "ray develop",
    "fix-lint": "ray lint --fix",
    "lint": "ray lint",
    "publish": "npx @raycast/api@latest publish"
  }
}
```

---

### 2. Types Definition

```typescript
// src/types/post.ts
export interface SubstackPost {
  id: number;
  title: string;
  slug: string;
  subtitle: string | null;
  post_date: string;
  canonical_url: string;
  cover_image: string | null;
  description: string | null;
  body_html: string;
  likes: number;
  comment_count: number;
  restacks: number;
  audience: "everyone" | "only_paid" | "founding";
  wordcount: number;
  reading_time: number;
}

export interface SubstackApiResponse {
  posts: SubstackPost[];
}

export interface PostStats {
  likes: number;
  comments: number;
  restacks: number;
}
```

---

### 3. API Client

```typescript
// src/api/substack.ts
import { Cache } from "@raycast/api";
import { SubstackPost, SubstackApiResponse } from "../types/post";

const PUBLICATION_URL = "https://raycastweekly.substack.com";
const CACHE_KEY = "substack-posts";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day in ms

const cache = new Cache();

const headers = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Accept: "application/json",
};

export async function fetchPosts(): Promise<SubstackPost[]> {
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    const { posts, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL) {
      return posts;
    }
  }

  const response = await fetch(`${PUBLICATION_URL}/api/v1/posts`, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.statusText}`);
  }

  const data = (await response.json()) as SubstackPost[];
  const sortedPosts = data.sort(
    (a, b) => new Date(b.post_date).getTime() - new Date(a.post_date).getTime()
  );

  cache.set(CACHE_KEY, JSON.stringify({ posts: sortedPosts, timestamp: Date.now() }));

  return sortedPosts;
}

export async function fetchPost(slug: string): Promise<SubstackPost> {
  const cacheKey = `post-${slug}`;
  const cached = cache.get(cacheKey);
  
  if (cached) {
    const { post, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL) {
      return post;
    }
  }

  const response = await fetch(`${PUBLICATION_URL}/api/v1/posts/${slug}`, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch post: ${response.statusText}`);
  }

  const post = (await response.json()) as SubstackPost;
  cache.set(cacheKey, JSON.stringify({ post, timestamp: Date.now() }));

  return post;
}

export function getPostUrl(slug: string): string {
  return `${PUBLICATION_URL}/p/${slug}`;
}

export function getSubscribeUrl(): string {
  return PUBLICATION_URL;
}

export function clearCache(): void {
  cache.clear();
}
```

---

### 4. HTML to Markdown Utility

```typescript
// src/utils/html-to-markdown.ts
import { NodeHtmlMarkdown } from "node-html-markdown";

const nhm = new NodeHtmlMarkdown({
  bulletMarker: "*",
  codeBlockStyle: "fenced",
  strongDelimiter: "**",
});

export function htmlToMarkdown(html: string): string {
  return nhm.translate(html);
}
```

---

### 5. Subscribe Command (No View)

```typescript
// src/subscribe.ts
import { open, showHUD } from "@raycast/api";
import { getSubscribeUrl } from "./api/substack";

export default async function Command() {
  await open(getSubscribeUrl());
  await showHUD("Opening Raycast Weekly subscription page...");
}
```

---

### 6. Browse Posts Command

```typescript
// src/browse-posts.tsx
import {
  Action,
  ActionPanel,
  Color,
  Detail,
  Icon,
  Keyboard,
  List,
} from "@raycast/api";
import { useCachedPromise, showFailureToast } from "@raycast/utils";
import { useState } from "react";
import { fetchPost, fetchPosts, getPostUrl, clearCache } from "./api/substack";
import { SubstackPost } from "./types/post";
import { htmlToMarkdown } from "./utils/html-to-markdown";

export default function Command() {
  const { data: posts, isLoading, revalidate } = useCachedPromise(fetchPosts, [], {
    onError: (error) => {
      showFailureToast(error, { title: "Failed to fetch posts" });
    },
  });

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search posts...">
      {posts?.map((post) => <PostListItem key={post.id} post={post} onRefresh={revalidate} />)}
    </List>
  );
}

function PostListItem({ post, onRefresh }: { post: SubstackPost; onRefresh: () => void }) {
  const date = new Date(post.post_date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const accessories: List.Item.Accessory[] = [
    { icon: Icon.Heart, text: String(post.likes), tooltip: "Likes" },
    { icon: Icon.Bubble, text: String(post.comment_count), tooltip: "Comments" },
    { icon: Icon.Clock, text: `${post.reading_time} min`, tooltip: "Reading time" },
    {
      tag: {
        value: post.audience === "everyone" ? "Free" : "Paid",
        color: post.audience === "everyone" ? Color.Green : Color.Orange,
      },
    },
  ];

  return (
    <List.Item
      icon={post.cover_image ? { source: post.cover_image } : Icon.Document}
      title={post.title}
      subtitle={post.subtitle || undefined}
      accessories={accessories}
      keywords={[post.title, post.subtitle || "", date]}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push
              icon={Icon.Eye}
              title="Read Post"
              target={<PostDetail slug={post.slug} />}
            />
            <Action.OpenInBrowser
              url={getPostUrl(post.slug)}
              shortcut={Keyboard.Shortcut.Common.Open}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.CopyToClipboard
              title="Copy Link"
              content={getPostUrl(post.slug)}
              shortcut={Keyboard.Shortcut.Common.CopyPath}
            />
            <Action
              icon={Icon.Share}
              title="Share Post"
              shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
              onAction={() => {
                const shareText = `${post.title}\n${getPostUrl(post.slug)}`;
                navigator.clipboard.writeText(shareText);
              }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              icon={Icon.ArrowClockwise}
              title="Refresh Posts"
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={() => {
                clearCache();
                onRefresh();
              }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function PostDetail({ slug }: { slug: string }) {
  const { data: post, isLoading } = useCachedPromise(fetchPost, [slug], {
    onError: (error) => {
      showFailureToast(error, { title: "Failed to fetch post" });
    },
  });

  if (isLoading || !post) {
    return <Detail isLoading={true} />;
  }

  const markdown = generatePostMarkdown(post);
  const metadata = generatePostMetadata(post);

  return (
    <Detail
      markdown={markdown}
      metadata={metadata}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser url={getPostUrl(slug)} />
          <Action.CopyToClipboard
            title="Copy Link"
            content={getPostUrl(slug)}
            shortcut={Keyboard.Shortcut.Common.CopyPath}
          />
          <Action.CopyToClipboard
            title="Copy as Markdown"
            content={markdown}
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
          />
        </ActionPanel>
      }
    />
  );
}

function generatePostMarkdown(post: SubstackPost): string {
  const header = `# ${post.title}\n\n`;
  const subtitle = post.subtitle ? `*${post.subtitle}*\n\n---\n\n` : "";
  const content = htmlToMarkdown(post.body_html);

  return `${header}${subtitle}${content}`;
}

function generatePostMetadata(post: SubstackPost) {
  const date = new Date(post.post_date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Detail.Metadata>
      <Detail.Metadata.Label title="Published" text={date} icon={Icon.Calendar} />
      <Detail.Metadata.Label
        title="Reading Time"
        text={`${post.reading_time} min`}
        icon={Icon.Clock}
      />
      <Detail.Metadata.Label
        title="Word Count"
        text={post.wordcount.toLocaleString()}
        icon={Icon.Text}
      />
      <Detail.Metadata.Separator />
      <Detail.Metadata.Label title="Likes" text={String(post.likes)} icon={Icon.Heart} />
      <Detail.Metadata.Label
        title="Comments"
        text={String(post.comment_count)}
        icon={Icon.Bubble}
      />
      <Detail.Metadata.Label
        title="Restacks"
        text={String(post.restacks)}
        icon={Icon.ArrowNe}
      />
      <Detail.Metadata.Separator />
      <Detail.Metadata.TagList title="Access">
        <Detail.Metadata.TagList.Item
          text={post.audience === "everyone" ? "Free" : "Paid"}
          color={post.audience === "everyone" ? Color.Green : Color.Orange}
        />
      </Detail.Metadata.TagList>
      <Detail.Metadata.Link title="View Online" target={getPostUrl(post.slug)} text="Open in Browser" />
    </Detail.Metadata>
  );
}
```

---

### 7. Submit Content Command

```typescript
// src/submit-content.tsx
import { Action, ActionPanel, Form, Icon, open, showHUD } from "@raycast/api";
import { useForm, showFailureToast } from "@raycast/utils";

interface FormValues {
  name: string;
  email: string;
  subject: string;
  content: string;
}

const RECIPIENT_EMAIL = "raycastweekly@substack.com";

export default function Command() {
  const { handleSubmit, itemProps, reset } = useForm<FormValues>({
    onSubmit: async (values) => {
      try {
        const mailtoUrl = buildMailtoUrl(values);
        await open(mailtoUrl);
        await showHUD("Opening email client...");
        reset();
      } catch (error) {
        showFailureToast(error, { title: "Failed to open email client" });
      }
    },
    validation: {
      name: (value) => {
        if (!value || value.trim().length === 0) {
          return "Name is required";
        }
      },
      email: (value) => {
        if (!value || value.trim().length === 0) {
          return "Email is required";
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return "Please enter a valid email address";
        }
      },
      subject: (value) => {
        if (!value || value.trim().length === 0) {
          return "Subject is required";
        }
      },
      content: (value) => {
        if (!value || value.trim().length < 10) {
          return "Content must be at least 10 characters";
        }
      },
    },
  });

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            icon={Icon.Envelope}
            title="Send Email"
            onSubmit={handleSubmit}
          />
          <Action
            icon={Icon.Trash}
            title="Clear Form"
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={reset}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Submit Content"
        text="Share your ideas, feedback, or content suggestions for Raycast Weekly newsletter."
      />
      <Form.TextField
        title="Name"
        placeholder="Your name"
        {...itemProps.name}
      />
      <Form.TextField
        title="Email"
        placeholder="your@email.com"
        {...itemProps.email}
      />
      <Form.TextField
        title="Subject"
        placeholder="Content submission: ..."
        {...itemProps.subject}
      />
      <Form.TextArea
        title="Content"
        placeholder="Describe your content idea, suggestion, or feedback..."
        enableMarkdown
        {...itemProps.content}
      />
      <Form.Separator />
      <Form.Description
        title="Note"
        text={`Your submission will be sent to ${RECIPIENT_EMAIL}`}
      />
    </Form>
  );
}

function buildMailtoUrl(values: FormValues): string {
  const subject = encodeURIComponent(`[Raycast Weekly Submission] ${values.subject}`);
  const body = encodeURIComponent(
    `Name: ${values.name}\nEmail: ${values.email}\n\n${values.content}`
  );

  return `mailto:${RECIPIENT_EMAIL}?subject=${subject}&body=${body}`;
}
```

---

### Summary of Features

| Feature | Implementation |
|---------|---------------|
| **Subscribe** | No-view command, opens browser |
| **Browse Posts** | List view with search, sorted newest first |
| **Read Post** | Detail view with markdown content + metadata sidebar |
| **Post Stats** | Likes, comments, restacks, reading time in accessories |
| **Open in Browser** | Action on both list and detail views |
| **Copy Link** | Quick action with `⌘+⇧+C` |
| **Share Post** | Copies title + URL |
| **Refresh** | Clears cache and reloads |
| **Submit Form** | Validated form → mailto link |
| **Caching** | 24-hour TTL with manual refresh |

### Next Steps

1. Run `npm install` to install dependencies
2. Test the API response structure from `https://raycastweekly.substack.com/api/v1/posts` and adjust types if needed
3. Add an extension icon (`extension-icon.png`)
4. Run `npm run dev` to test locally

Would you like me to add any additional features like keyboard navigation hints, empty states, or error boundaries?

