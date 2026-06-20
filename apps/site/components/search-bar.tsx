import { CityInput } from './city-input';

type SearchBarProps = {
  defaultQuery?: string;
  defaultCity?: string;
  defaultHomeVisit?: boolean;
  defaultKassenart?: string;
};

// Plain GET form — submitting re-navigates to /finden with the values as
// query params, so the results page can stay a server component with no
// client-side search state.
export function SearchBar({ defaultQuery = '', defaultCity = '', defaultHomeVisit = false, defaultKassenart = '' }: SearchBarProps) {
  return (
    <form method="GET" action="/finden" className="search-form">
      <div className="search-form__row">
        <label className="field">
          <span>Beschwerde oder Spezialisierung</span>
          <input type="text" name="q" defaultValue={defaultQuery} placeholder="z. B. Rückenschmerzen" />
        </label>
        <div className="field">
          <label htmlFor="finden-city">Ort</label>
          <CityInput id="finden-city" name="city" defaultValue={defaultCity} placeholder="z. B. Köln" required />
        </div>
      </div>

      <div className="search-form__row search-form__row--filters">
        <label className="search-form__checkbox">
          <input type="checkbox" name="homeVisit" value="true" defaultChecked={defaultHomeVisit} />
          <span>Hausbesuch möglich</span>
        </label>

        <label className="field search-form__kassenart">
          <span>Kassenart</span>
          <select name="kassenart" defaultValue={defaultKassenart}>
            <option value="">Alle</option>
            <option value="gesetzlich">Gesetzlich</option>
            <option value="privat">Privat</option>
            <option value="selbstzahler">Selbstzahler</option>
          </select>
        </label>

        <button type="submit" className="button button--primary search-form__submit">
          Suchen
        </button>
      </div>
    </form>
  );
}
