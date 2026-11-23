import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Skeleton, SkeletonHeader, SkeletonList, SkeletonStatus, SkeletonText } from "./skeleton";

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("skeleton primitives", () => {
  it("should_render_a_decorative_shimmer_block_when_given_a_size", () => {
    const html = renderToStaticMarkup(<Skeleton className="h-4 w-20" />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-slot="skeleton"');
    expect(html).toContain("motion-skeleton");
    expect(html).toContain("h-4 w-20");
  });

  it("should_announce_one_busy_status_with_the_label_and_hide_the_placeholders", () => {
    const html = renderToStaticMarkup(
      <SkeletonStatus label="Loading submitted offers">
        <Skeleton className="h-4" />
      </SkeletonStatus>,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('<span class="sr-only">Loading submitted offers</span>');
    expect(count(html, 'aria-hidden="true"')).toBe(1);
  });

  it("should_render_the_requested_number_of_text_lines", () => {
    const html = renderToStaticMarkup(<SkeletonText lines={3} />);

    expect(count(html, 'data-slot="skeleton"')).toBe(3);
  });

  it("should_mirror_a_page_header_with_optional_eyebrow_and_action", () => {
    const withAll = renderToStaticMarkup(<SkeletonHeader eyebrow descriptionLines={2} action />);
    const titleOnly = renderToStaticMarkup(<SkeletonHeader eyebrow={false} descriptionLines={0} />);

    expect(withAll).toContain("<header");
    expect(count(withAll, 'data-slot="skeleton"')).toBe(5);
    expect(count(titleOnly, 'data-slot="skeleton"')).toBe(1);
  });

  it("should_render_one_list_item_per_row_with_title_and_meta_lines", () => {
    const html = renderToStaticMarkup(<SkeletonList rows={4} metaLines={2} />);

    expect(count(html, "<li")).toBe(4);
    expect(count(html, 'data-slot="skeleton"')).toBe(4 * 3);
  });
});
