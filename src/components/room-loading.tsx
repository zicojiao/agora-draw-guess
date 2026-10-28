import { LoadingCompanion } from './loading-companion'

export function RoomLoading({ roomId }: { roomId: string }) {
  return <main className="dg-room-shell dg-room-loading" aria-busy="true">
    <section className="dg-room-loading__card">
      <LoadingCompanion label="正在打开画室…" />
      <p>房间 <strong>{roomId.toUpperCase()}</strong></p>
      <div className="dg-room-loading__dots" aria-hidden="true"><i /><i /><i /></div>
    </section>
  </main>
}
