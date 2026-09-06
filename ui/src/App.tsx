// The app is the default; the story is a mode.
import { useRoute } from './lib/router';
import { Chrome } from './app/Chrome';
import { Home } from './app/Home';
import { PoliciesPage } from './app/PoliciesPage';
import { PolicyPage } from './app/PolicyPage';
import { Story } from './story/Story';

export default function App() {
  const route = useRoute();
  if (route.name === 'story') return <Story />;
  return (
    <div className="app">
      <Chrome route={route} />
      <div className="app-body">
        {route.name === 'home' ? <Home /> : route.name === 'policies' ? <PoliciesPage /> : <PolicyPage key={route.serial} serial={route.serial} />}
      </div>
    </div>
  );
}
