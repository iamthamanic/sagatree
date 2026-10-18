"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs@1.1.3";

import { cn } from "./utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-muted/60 inline-flex h-10 w-fit items-center justify-center rounded-lg border border-foreground/10 p-1 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // Inactive first; active uses primary-foreground (THEME_GUIDE: dark on cyan in .dark).
        "text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-sm font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow,color,transform] duration-150 active:scale-[0.98] focus-visible:border-primary focus-visible:ring-primary/30 focus-visible:outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 hover:border-accent/40 hover:bg-accent/10 hover:text-accent motion-reduce:transform-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:shadow-sm data-[state=active]:!text-primary-foreground data-[state=active]:[&_svg]:!text-primary-foreground data-[state=active]:hover:bg-accent data-[state=active]:hover:border-accent data-[state=active]:hover:!text-accent-foreground data-[state=active]:hover:[&_svg]:!text-accent-foreground data-[state=active]:active:bg-accent/90",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
