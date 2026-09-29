export function RoomAvatar({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`room-avatar room-avatar-${size} tone-${color}`} aria-hidden="true">
      {name}
    </span>
  );
}
