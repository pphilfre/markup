import type { Settings } from "@/lib/store";

export type DbUser = {
  workosId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
};

export type DbFolder = {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  sortOrder: number;
};

export type DbProfile = {
  id: string;
  name: string;
};

export type DbWorkspace = {
  userId: string;
  activeTabId?: string | null;
  openTabIds?: string[];
  folders?: DbFolder[];
  viewMode?: string;
  theme?: string;
  fileTreeOpen?: boolean;
  settings?: Partial<Settings>;
  profiles?: DbProfile[];
  activeProfileId?: string;
};

export type DbTab = {
  userId: string;
  tabId: string;
  title: string;
  content: string;
  workspaceId?: string;
  folderId: string | null;
  tags?: string[];
  pinned?: boolean;
  noteType?: string;
  customIcon?: string;
  iconColor?: string;
};

export type DbSharedNote = {
  shareId: string;
  ownerUserId: string;
  tabId: string;
  title: string;
  content: string;
  visibility: string;
  permission: string;
  allowedUsers: string[];
  noteType?: string;
  whiteboardData?: string;
  mindmapData?: string;
};

export type DbSite = {
  slug: string;
  ownerUserId: string;
  tabId: string;
  title: string;
  content: string;
  publishedAt: number;
  updatedAt: number;
};

export type DbWhiteboard = {
  userId: string;
  elements: string;
  canvasSettings: string;
};

export type DbMindmap = {
  userId: string;
  nodes: string;
  connections: string;
  settings: string;
};

export type DbPdfMetadata = {
  userId: string;
  tabId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt?: number;
  storageId?: string;
};
