import { redirect } from 'next/navigation';

export default async function OldEngineeringHealthPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const queryEntries = Object.entries(resolvedSearchParams).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  const queryString = queryEntries.length > 0
    ? '?' + new URLSearchParams(queryEntries).toString()
    : '';

  redirect(`/engineering-health${queryString}`);
}
