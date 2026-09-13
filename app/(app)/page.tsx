import { auth } from "@clerk/nextjs/server"
import Image from "next/image"

import { ChatComposer } from "@/components/chat-composer"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { CREATE_GAME_FORM_ID, suggestions } from "@/lib/games/suggestions"

export default async function Page() {
  await auth.protect()

  return (
    <div className="flex min-h-svh">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <Image src="/logo.svg" alt="Logo" width={48} height={48} />
          </EmptyMedia>
          <EmptyTitle className="text-2xl">
            What should we build today?
          </EmptyTitle>
          <EmptyDescription>
            Build your own racers, shooters, puzzles and whole worlds using your
            own words. If you can describe it, you can play it.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="max-w-2xl gap-6">
          <ChatComposer />
          <div className="flex flex-wrap items-center justify-center gap-2">
            {suggestions.map(({ icon: Icon, label }) => (
              <Button
                key={label}
                type="submit"
                form={CREATE_GAME_FORM_ID}
                name="suggestion"
                value={label}
                variant="outline"
                size="sm"
                className="rounded-full font-normal text-muted-foreground"
              >
                <Icon data-icon="inline-start" />
                {label}
              </Button>
            ))}
          </div>
        </EmptyContent>
      </Empty>
    </div>
  )
}
