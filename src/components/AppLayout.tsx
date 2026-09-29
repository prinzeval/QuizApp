import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ActionIcon,
  AppShell,
  Burger,
  Container,
  Group,
  Image,
  Menu,
  NavLink,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
  type MantineColorScheme,
} from "@mantine/core";
import { useDisclosure, useWindowEvent } from "@mantine/hooks";
import {
  IconCheck,
  IconDeviceDesktop,
  IconHome,
  IconKey,
  IconLogout,
  IconMoon,
  IconPlus,
  IconSelector,
  IconSun,
  IconUserCircle,
} from "@tabler/icons-react";
import { useAuth } from "../auth/AuthContext.tsx";
import { useIsMobile } from "../hooks/useIsMobile.ts";
import { useRooms } from "../hooks/rooms.ts";
import { RoomAvatar } from "./RoomAvatar.tsx";
import { UserAvatar } from "./UserAvatar.tsx";

/** Shell for every logged-in page: sidebar (a drawer below `sm`) + page content. */
export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const location = useLocation();

  // Close the drawer whenever the page changes.
  useEffect(close, [location.pathname, location.search, close]);
  useWindowEvent("keydown", event => event.key === "Escape" && close());

  return (
    <AppShell
      header={{ height: { base: 56, sm: 0 } }}
      navbar={{ width: 264, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding={0}
      bg="var(--app-canvas)"
    >
      <AppShell.Header hiddenFrom="sm" px="md" bg="var(--app-canvas)">
        <Group h="100%" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} size="sm" w={40} h={40} aria-label={opened ? "Close menu" : "Open menu"} />
            <Logo />
          </Group>
          <MobileAvatarLink />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar aria-label="Main navigation" bg="var(--app-sidebar)">
        <Sidebar />
      </AppShell.Navbar>

      <AppShell.Main bg="var(--app-canvas)">
        <Container size="lg" px={{ base: "md", sm: "xl" }} py={{ base: "lg", sm: 40 }}>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

function Logo() {
  return (
    <UnstyledButton component={Link} to="/" aria-label="SmartQuiz home" display="flex" h={40} style={{ alignItems: "center" }}>
      <Group gap={10} wrap="nowrap">
        <Image src="/favicon.jpg" alt="" w={28} h={28} radius="sm" />
        <Text fw={700} size="lg" style={{ letterSpacing: "-0.01em" }}>
          SmartQuiz
        </Text>
      </Group>
    </UnstyledButton>
  );
}

function MobileAvatarLink() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <UnstyledButton component={Link} to="/settings" aria-label="Profile and settings">
      <UserAvatar name={user.name} url={user.avatarUrl} size={40} />
    </UnstyledButton>
  );
}

function Sidebar() {
  const rooms = useRooms();
  const { pathname } = useLocation();
  const mobile = useIsMobile();

  return (
    <>
      <AppShell.Section p="md" pb="xs" visibleFrom="sm">
        <Logo />
      </AppShell.Section>

      <AppShell.Section px="sm" pt={{ base: "sm", sm: 0 }}>
        <NavLink component={Link} to="/" label="All rooms" leftSection={<IconHome size={18} stroke={1.8} />} active={pathname === "/"} />
        <NavLink
          component={Link}
          to="/settings"
          label="Profile & settings"
          leftSection={<IconUserCircle size={18} stroke={1.8} />}
          active={pathname.startsWith("/settings")}
        />
      </AppShell.Section>

      <AppShell.Section grow component={ScrollArea} px="sm" mt="md">
        <Group justify="space-between" px="sm" mb={4}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.04em" }}>
            Your rooms
          </Text>
          <Tooltip label="New room" withArrow position="right">
            <ActionIcon component={Link} to="/?new=1" variant="subtle" color="gray" size={mobile ? 40 : "md"} aria-label="New room">
              <IconPlus size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        {rooms.isPending && (
          <Stack gap={8} px="sm" py={6} aria-label="Loading rooms">
            <Skeleton h={24} />
            <Skeleton h={24} />
          </Stack>
        )}
        {rooms.data?.length === 0 && (
          <Text size="sm" c="dimmed" px="sm" py={6}>
            No rooms yet
          </Text>
        )}
        {rooms.data?.map(room => (
          <NavLink
            key={room.id}
            component={Link}
            to={`/rooms/${room.id}`}
            data-testid="nav-room"
            title={room.name}
            label={room.name}
            leftSection={<RoomAvatar room={room} size={24} />}
            active={pathname === `/rooms/${room.id}`}
            styles={{ label: ONE_LINE, body: { minWidth: 0 } }}
          />
        ))}
      </AppShell.Section>

      <AppShell.Section p="sm" style={{ borderTop: "1px solid var(--app-shell-border-color)" }}>
        <UserMenu />
      </AppShell.Section>
    </>
  );
}

/** Keep a NavLink label/description on one line with an ellipsis. */
const ONE_LINE = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

const SCHEMES: { value: MantineColorScheme; label: string; icon: typeof IconSun }[] = [
  { value: "light", label: "Light", icon: IconSun },
  { value: "dark", label: "Dark", icon: IconMoon },
  { value: "auto", label: "System", icon: IconDeviceDesktop },
];

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  if (!user) return null;

  return (
    <Menu position="top-start" width="target" shadow="md" withinPortal>
      <Menu.Target>
        <NavLink
          component="button"
          data-testid="user-button"
          title={`${user.name}\n${user.email}`}
          label={user.name}
          description={user.email}
          leftSection={<UserAvatar name={user.name} url={user.avatarUrl} size={36} />}
          rightSection={<IconSelector size={16} aria-hidden="true" />}
          styles={{ label: { ...ONE_LINE, fontWeight: 600 }, description: ONE_LINE, body: { flex: 1, minWidth: 0, overflow: "hidden" } }}
        />
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconUserCircle size={16} />} onClick={() => navigate("/settings")}>
          Profile & settings
        </Menu.Item>
        <Menu.Item leftSection={<IconKey size={16} />} onClick={() => navigate("/settings/security")}>
          Change password
        </Menu.Item>
        <Menu.Divider />
        <Menu.Label>Theme</Menu.Label>
        {SCHEMES.map(({ value, label, icon: Icon }) => (
          <Menu.Item
            key={value}
            leftSection={<Icon size={16} />}
            rightSection={colorScheme === value ? <IconCheck size={14} aria-label="(selected)" /> : null}
            onClick={() => setColorScheme(value)}
            closeMenuOnClick={false}
          >
            {label}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={logout}>
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
