export default function ClubList({
  clubs = [],
  onSelect,
  userLocation,
  favorites,
  onToggleFavorite,
}) {
  return (
    <div className="clubList">
      <div className="clubListHeader">
        <strong>Clubs ({clubs.length})</strong>
        {userLocation ? <span className="clubListHint">por distancia</span> : null}
      </div>

      <ul className="clubListItems">
        {clubs.map((club) => {
          const isFav = favorites?.has?.(String(club.id));

          return (
            <li key={club.id} className="clubListItem">
              <div className="clubListRow">
                <button
                  type="button"
                  onClick={() => onSelect(club)}
                  className="clubCard"
                >
                  <div className="clubCardTop">
                    <strong className="clubName">{club.name}</strong>

                    {typeof club.distanceKm === "number" ? (
                      <span className="clubDistance">
                        {club.distanceKm.toFixed(1)} km
                      </span>
                    ) : null}
                  </div>

                  {club.city ? <div className="clubCity">{club.city}</div> : null}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleFavorite?.(club.id)}
                  aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
                  title={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
                  className={`clubFavBtn ${isFav ? "isFav" : ""}`}
                >
                  {isFav ? "⭐" : "☆"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
