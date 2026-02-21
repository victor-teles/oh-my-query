import type { Components } from "@json-render/react";

import { defineCatalog } from "@json-render/core";
import {
  defineRegistry,
  JSONUIProvider,
  Renderer,
  schema,
} from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";

const displayComponents = {
  Accordion: shadcnComponentDefinitions.Accordion,
  Alert: shadcnComponentDefinitions.Alert,
  Avatar: shadcnComponentDefinitions.Avatar,
  Badge: shadcnComponentDefinitions.Badge,
  Card: shadcnComponentDefinitions.Card,
  Collapsible: shadcnComponentDefinitions.Collapsible,
  Grid: shadcnComponentDefinitions.Grid,
  Heading: shadcnComponentDefinitions.Heading,
  Image: shadcnComponentDefinitions.Image,
  Progress: shadcnComponentDefinitions.Progress,
  Separator: shadcnComponentDefinitions.Separator,
  Stack: shadcnComponentDefinitions.Stack,
  Table: shadcnComponentDefinitions.Table,
  Tabs: shadcnComponentDefinitions.Tabs,
  Text: shadcnComponentDefinitions.Text,
} as const;

export const catalog = defineCatalog(schema, {
  actions: {},
  components: displayComponents,
});

type AppCatalog = typeof catalog;

const { registry } = defineRegistry(catalog, {
  components: {
    Accordion: shadcnComponents.Accordion,
    Alert: shadcnComponents.Alert,
    Avatar: shadcnComponents.Avatar,
    Badge: shadcnComponents.Badge,
    Card: shadcnComponents.Card,
    Collapsible: shadcnComponents.Collapsible,
    Grid: shadcnComponents.Grid,
    Heading: shadcnComponents.Heading,
    Image: shadcnComponents.Image,
    Progress: shadcnComponents.Progress,
    Separator: shadcnComponents.Separator,
    Stack: shadcnComponents.Stack,
    Table: shadcnComponents.Table,
    Tabs: shadcnComponents.Tabs,
    Text: shadcnComponents.Text,
  } as unknown as Components<AppCatalog>,
});

export { JSONUIProvider, Renderer, registry };
