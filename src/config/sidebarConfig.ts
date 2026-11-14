import type { SidebarLayoutConfig } from "../types/sidebarConfig";

export const sidebarLayoutConfig: SidebarLayoutConfig = {
	enable: true,
	position: "left",
	hideSidebarOnPostPage: false,
	noSidebarContentWidth: 1,
	leftComponents: [
		{
			type: "profile",
			enable: true,
			position: "top",
			showOnPostPage: true,
		},
		{
			type: "sidebarToc",
			enable: true,
			position: "sticky",
			showOnPostPage: true,
			hideOnNonPostPage: true,
		},
	],
	rightComponents: [],
	mobileBottomComponents: [
		{
			type: "profile",
			enable: true,
			showOnPostPage: true,
		},
	],
};
