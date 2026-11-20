"use client";

import React from "react";
import { Badge, type BadgeProps } from "@astryxdesign/core/Badge";
import { Banner, type BannerProps } from "@astryxdesign/core/Banner";
import { Button, type ButtonProps } from "@astryxdesign/core/Button";
import { Card, type CardProps } from "@astryxdesign/core/Card";
import { Switch, type SwitchProps } from "@astryxdesign/core/Switch";

export type { BadgeProps, BannerProps, ButtonProps, CardProps, SwitchProps };

export function AstryxButton(props: ButtonProps) {
  return <Button {...props} />;
}

export function AstryxBadge(props: BadgeProps) {
  return <Badge {...props} />;
}

export function AstryxSwitch(props: SwitchProps) {
  return <Switch {...props} />;
}

export function AstryxBanner({ collapsible = false, ...rest }: BannerProps) {
  return <Banner collapsible={collapsible} {...rest} />;
}

export function AstryxCard(props: CardProps) {
  return <Card {...props} />;
}
