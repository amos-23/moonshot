import { removePhotoAction, setFeaturedAction, setHiddenAction } from "@/lib/actions";
import { ActionButton } from "@/components/client";
import { Tag, cx } from "@/components/ui";

export type Kind = "person" | "post" | "comment" | "moment" | "checkin";

/** One card, moment, comment, X card or check-in, with what an admin can do to it. */
export function ModRow({
  kind,
  id,
  title,
  sub,
  hidden,
  photo,
  tags,
  featured,
  canFeature,
  removablePhoto,
}: {
  kind: Kind;
  id: string;
  title: string;
  sub: string;
  hidden: boolean;
  photo?: string | null;
  tags?: React.ReactNode;
  featured?: boolean;
  canFeature?: boolean;
  removablePhoto?: boolean;
}) {
  return (
    <li className={cx("flex flex-wrap items-center gap-3 px-4 py-3 text-sm sm:flex-nowrap", hidden && "bg-canvas/70")}>
      {photo ? (
        <a href={photo} target="_blank" rel="noopener" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="h-11 w-11 rounded-xl object-cover" loading="lazy" />
        </a>
      ) : (
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-canvas text-base font-bold text-muted">
          {title.replace(/^@/, "").charAt(0).toUpperCase() || "·"}
        </span>
      )}
      <span className={cx("min-w-0 flex-1", hidden && "opacity-60")}>
        <span className="block truncate font-semibold">{title}</span>
        <span className="line-clamp-2 text-muted">{sub}</span>
      </span>
      <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {hidden && <Tag>hidden</Tag>}
        {featured && <Tag tone="sun">★ Featured</Tag>}
        {tags}
        {canFeature && !hidden && (
          <ActionButton action={setFeaturedAction.bind(null, id, !featured)} variant={featured ? "secondary" : "ghost"}>
            {featured ? "Unpin" : "Feature this"}
          </ActionButton>
        )}
        {removablePhoto && photo && (
          <ActionButton action={removePhotoAction.bind(null, id)} variant="ghost" confirm="Remove this photo?">
            Remove photo
          </ActionButton>
        )}
        <ActionButton action={setHiddenAction.bind(null, kind, id, !hidden)} variant={hidden ? "secondary" : "danger"}>
          {hidden ? "Unhide" : "Hide"}
        </ActionButton>
      </span>
    </li>
  );
}
