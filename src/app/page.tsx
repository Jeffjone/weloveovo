import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Disc3,
  Radio,
  Route,
  Orbit,
  Network,
  Gamepad2,
  Archive,
} from 'lucide-react';
import { story, homepageFeatures } from '@/lib/editorial';
import { statistics } from '@/lib/catalog';
import s from './home.module.css';
export const dynamic = 'force-dynamic';
const entrances = [
  {
    href: '/records',
    title: 'The Records',
    description: 'The albums. The deep cuts. The feeling.',
    icon: Disc3,
    number: '01',
  },
  {
    href: '/eras',
    title: 'The Eras',
    description: 'Every chapter changed the story.',
    icon: Route,
    number: '02',
  },
  {
    href: '/listening-room',
    title: 'The Listening Room',
    description: 'Late nights have a frequency.',
    icon: Radio,
    number: '03',
  },
  {
    href: '/legacy',
    title: 'The Legacy',
    description: 'A City in His Voice. A world in the echoes.',
    icon: Orbit,
    number: '04',
  },
  {
    href: '/vault',
    title: 'The Vault',
    description: 'Unreleased recordings. Fragments. Freestyle references.',
    icon: Archive,
    number: '06',
  },
];
export default async function HomePage() {
  const [stats, intro, artwork] = await Promise.all([
    statistics(),
    story('home'),
    homepageFeatures(),
  ]);
  return (
    <div className={s.lobby}>
      <div className={s.topline}>
        <span>
          <i /> THE CITY IS ASLEEP. THE MUSIC ISN’T.
        </span>
        <span>43.6532° N / 79.3832° W</span>
      </div>
      <section className={s.hero}>
        <div className={s.heroCopy}>
          <p className={s.kicker}>{intro?.title}</p>
          <h1>
            welove<span>ovo</span>
          </h1>
          {intro && (
            <p className={s.deck} style={{ whiteSpace: 'pre-line' }}>
              {intro.body}
            </p>
          )}
          <Link href="/listening-room" className={s.enter}>
            Find Your Frequency <ArrowRight size={17} />
          </Link>
        </div>
        <div className={s.heroAside}>
          <span className={s.coordinates}>FROM TORONTO / TO EVERYWHERE</span>
          <Link href="/connections" className={s.orbit} aria-label="Explore the connections">
            <span>6</span>
            <i />
            <b />
          </Link>
          <p>
            Some music you listen to.
            <br />
            <span>Some music you live in.</span>
          </p>
          <Link href="/connections">
            <Network size={14} /> Everything is connected <ArrowUpRight size={13} />
          </Link>
        </div>
      </section>
      <div className={s.roomHeading}>
        <span>CHOOSE YOUR ROOM</span>
        <Link href="/games">
          <Gamepad2 size={13} /> 05 / THE GAME ROOM ↗
        </Link>
      </div>
      <section className={s.rooms} aria-label="Choose a room">
        {entrances.map((room) => (
          <Link className={s.room} href={room.href} key={room.href}>
            {artwork.find((a) => '/' + a.id === room.href)?.cover_url && (
              <img
                src={artwork.find((a) => '/' + a.id === room.href)!.cover_url!}
                alt=""
                loading="lazy"
                width="400"
                height="400"
              />
            )}
            <div className={s.roomTop}>
              <span>{room.number} / ENTER</span>
              <room.icon size={20} />
            </div>
            <h2>
              {room.title}
              <ArrowUpRight size={19} />
            </h2>
            <p>{room.description}</p>
          </Link>
        ))}
      </section>
      <div className={s.bottomline}>
        <span>
          {stats.tracks} TRACKS <i /> {stats.releases} RELEASES <i /> COUNTLESS CONNECTIONS
        </span>
        <span>AN INDEPENDENT EXPLORATION OF DRAKE’S WORLD</span>
      </div>
    </div>
  );
}
