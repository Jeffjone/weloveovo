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
} from 'lucide-react';
import { statistics } from '@/lib/catalog';
import s from './home.module.css';
export const dynamic = 'force-dynamic';
const entrances = [
  {
    href: '/records',
    title: 'The records',
    description: 'The albums. The deep cuts. The feeling.',
    icon: Disc3,
    number: '01',
    image: 'take-care-deluxe.jpg',
  },
  {
    href: '/eras',
    title: 'The eras',
    description: 'Every chapter changed the story.',
    icon: Route,
    number: '02',
    image: 'nothing-was-the-same-deluxe.jpg',
  },
  {
    href: '/listening-room',
    title: 'The listening room',
    description: 'Late nights have a frequency.',
    icon: Radio,
    number: '03',
    image: 'views.jpg',
  },
  {
    href: '/legacy',
    title: 'The legacy',
    description: 'A city in his voice. A world in the echoes.',
    icon: Orbit,
    number: '04',
    image: 'scorpion.jpg',
  },
];
export default async function HomePage() {
  const stats = await statistics();
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
          <p className={s.kicker}>WELCOME TO THE OTHER SIDE OF MIDNIGHT</p>
          <h1>
            welove<span>ovo</span>
          </h1>
          <p className={s.deck}>
            One city. A thousand memories.
            <br />
            Step inside the sound, the stories, and the world of Drake.
          </p>
          <Link href="/listening-room" className={s.enter}>
            Find your frequency <ArrowRight size={17} />
          </Link>
        </div>
        <div className={s.heroAside}>
          <span className={s.coordinates}>EST. IN THE 6</span>
          <div className={s.orbit}>
            <span>6</span>
            <i />
            <b />
          </div>
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
          <Gamepad2 size={13} /> NEW / THE GAME ROOM ↗
        </Link>
      </div>
      <section className={s.rooms} aria-label="Choose a room">
        {entrances.map((room) => (
          <Link className={s.room} href={room.href} key={room.href}>
            <img src={'/assets/albums/' + room.image} alt="" />
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
