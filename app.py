import os
import requests
from functools import wraps
from urllib.parse import quote
from flask import Flask, render_template, request, redirect, url_for, session, flash, abort

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'change-this-secret-before-deployment')
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Lax')
API_BASE_URL = os.environ.get('API_BASE_URL', 'https://web-database.onrender.com').rstrip('/')
API_ADMIN_TOKEN = os.environ.get('API_ADMIN_TOKEN', '')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')
TIMEOUT = (5, 20)


def api_request(method, path='/movies', **kwargs):
    headers = kwargs.pop('headers', {})
    if kwargs.pop('admin', False):
        if not API_ADMIN_TOKEN:
            raise RuntimeError('API_ADMIN_TOKEN is not configured on the frontend.')
        headers['X-Admin-Token'] = API_ADMIN_TOKEN
    response = requests.request(method, f'{API_BASE_URL}{path}', headers=headers, timeout=TIMEOUT, **kwargs)
    response.raise_for_status()
    return response.json() if response.content else None


def get_movies(params=None):
    try:
        data = api_request('GET', '/movies', params=params or {})
        return data if isinstance(data, list) else []
    except requests.RequestException:
        app.logger.exception('Movie API request failed')
        return None


def group_key(movie):
    return str(movie.get('franchise_id') or movie.get('rel') or '').strip()
    
def movie_categories(movie):
    """Collect category labels from existing movie fields."""
    values = []

    for field in ('genre', 'genres', 'category', 'categories', 'type', 'media_type'):
        value = movie.get(field)

        if isinstance(value, list):
            values.extend(value)
        elif isinstance(value, str):
            values.extend(value.replace('|', ',').replace('/', ',').split(','))

    return sorted({
        str(value).strip()
        for value in values
        if value and str(value).strip()
    }, key=str.casefold)


def movie_matches_query(movie, query):
    if not query:
        return True

    searchable = [
        movie.get('title', ''),
        movie.get('desc', ''),
        movie.get('cast', ''),
        movie.get('genre', ''),
        movie.get('genres', ''),
        movie.get('category', ''),
        movie.get('categories', ''),
        movie.get('type', ''),
        movie.get('media_type', '')
    ]

    searchable_text = ' '.join(
        ' '.join(str(value) for value in item)
        if isinstance(item, list)
        else str(item or '')
        for item in searchable
    ).casefold()

    return query.casefold() in searchable_text


def is_series(movie):
    media = ' '.join(
        str(movie.get(field) or '')
        for field in ('type', 'media_type')
    ).casefold()

    return (
        'series' in media
        or 'tv show' in media
        or 'tv series' in media
        or 'anime' in media
        or bool(movie.get('season_number'))
        or bool(movie.get('episode_number'))
    )
def related_movies(movie, all_movies):
    movie_id = str(movie.get('id'))
    related_ids = {str(value) for value in movie.get('related_ids', [])}
    key = group_key(movie)
    related = []
    for candidate in all_movies:
        candidate_id = str(candidate.get('id'))
        if candidate_id == movie_id:
            continue
        candidate_related = {str(value) for value in candidate.get('related_ids', [])}
        same_auto_group = bool(key) and group_key(candidate) == key
        manual_link = candidate_id in related_ids or movie_id in candidate_related
        if same_auto_group or manual_link:
            related.append(candidate)
    return related


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get('admin_logged_in'):
            return redirect(url_for('admin_login', next=request.path))
        return view(*args, **kwargs)
    return wrapped


@app.context_processor
def inject_globals():
    return {'site_name': 'TVHOME'}


@app.route('/')
@app.route('/')
def home():
    movies = get_movies()

    if movies is None:
        return render_template(
            'home.html',
            movies=[],
            featured=[],
            series=[],
            api_offline=True
        ), 503

    # Newest entries first
    movies = sorted(
        movies,
        key=lambda m: int(m.get('id', 0))
        if str(m.get('id', '')).isdigit() else 0,
        reverse=True
    )

    # Trending movies
    featured = movies[:5]

    # All TV series
    series = [
        movie for movie in movies
        if is_series(movie)
    ]

    return render_template(
        'home.html',
        movies=movies,
        featured=featured,
        series=series,
        api_offline=False
    )
@app.route('/search')
def search():
    query = request.args.get('q', '').strip()
    selected_category = request.args.get('category', '').strip()

    all_movies = get_movies()

    if all_movies is None:
        return render_template(
            'search.html',
            movies=[],
            query=query,
            categories=[],
            selected_category=selected_category,
            api_offline=True
        )

    categories = sorted(
        {
            category
            for movie in all_movies
            for category in movie_categories(movie)
        },
        key=str.casefold
    )

    movies = [
        movie for movie in all_movies
        if movie_matches_query(movie, query)
        and (
            not selected_category
            or selected_category.casefold() in {
                category.casefold()
                for category in movie_categories(movie)
            }
        )
    ]

    return render_template(
        'search.html',
        movies=movies,
        query=query,
        categories=categories,
        selected_category=selected_category,
        api_offline=False
    )
@app.route('/movie/<movie_id>')
def movie_detail(movie_id):
    movies = get_movies()
    if movies is None:
        return render_template('error.html', message='The movie service is temporarily unavailable.'), 503
    movie = next((m for m in movies if str(m.get('id')) == str(movie_id)), None)
    if not movie:
        abort(404)
    related = related_movies(movie, movies)
    return render_template('movie.html', movie=movie, related=related)


@app.route('/collection/<path:collection_id>')
def collection(collection_id):
    movies = get_movies()
    if movies is None:
        return render_template('error.html', message='The movie service is temporarily unavailable.'), 503
    selected = next((m for m in movies if str(m.get('id')) == collection_id), None)
    if selected:
        members = [selected] + related_movies(selected, movies)
        title = selected.get('franchise_id') or selected.get('rel') or selected.get('title', 'Related titles')
    else:
        members = [m for m in movies if group_key(m) == collection_id]
        title = collection_id
    # Include manually linked items when collection is reached by a group key.
    ids = {str(m.get('id')) for m in members}
    for movie in movies:
        if ids.intersection(str(v) for v in movie.get('related_ids', [])) and str(movie.get('id')) not in ids:
            members.append(movie)
            ids.add(str(movie.get('id')))
    return render_template('collection.html', movies=members, title=title)


@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        if ADMIN_PASSWORD and request.form.get('password', '') == ADMIN_PASSWORD:
            session['admin_logged_in'] = True
            flash('Welcome back. You are signed in.', 'success')
            return redirect(request.args.get('next') or url_for('admin_dashboard'))
        flash('The password was not accepted.', 'error')
    return render_template('admin_login.html')


@app.route('/admin/logout')
def admin_logout():
    session.clear()
    flash('You have been signed out.', 'success')
    return redirect(url_for('home'))


@app.route('/admin')
@admin_required
def admin_dashboard():
    movies = get_movies()
    if movies is None:
        flash('Could not connect to the movie API.', 'error')
        movies = []
    return render_template('admin_dashboard.html', movies=movies)



def form_payload():
    related_ids = [value for value in request.form.getlist('related_ids') if value]

    server_names = request.form.getlist('server_names')
    server_urls = request.form.getlist('server_urls')

    servers = []

    for name, url in zip(server_names, server_urls):
        name = name.strip()
        url = url.strip()

        if name and url:
            servers.append({
                'name': name,
                'url': url
            })

    return {
        'title': request.form.get('title', '').strip(),
        'img': request.form.get('img', '').strip(),
        'desc': request.form.get('desc', '').strip(),
        'cast': request.form.get('cast', '').strip(),
        'url': servers[0]['url'] if servers else '',
        'servers': servers,
        'type': request.form.get('type', '').strip(),
        'media_type': request.form.get('media_type', '').strip(),
        'rel': request.form.get('rel', '').strip(),
        'franchise_id': request.form.get('franchise_id', '').strip(),
        'release_year': request.form.get('release_year', '').strip(),
        'season_number': request.form.get('season_number', '').strip(),
        'episode_number': request.form.get('episode_number', '').strip(),
        'related_ids': related_ids,
    }



@app.route('/admin/movie/new', methods=['GET', 'POST'])
@admin_required
def admin_new_movie():
    movies = get_movies() or []
    if request.method == 'POST':
        try:
            payload = form_payload()
            # Empty optional numeric fields are omitted by the API.
            api_request('POST', '/movies', json=payload, admin=True)
            flash('The title was added successfully.', 'success')
            return redirect(url_for('admin_dashboard'))
        except (requests.RequestException, RuntimeError, ValueError) as exc:
            flash(f'Could not add title: {getattr(exc, "response", None).text if getattr(exc, "response", None) is not None else str(exc)}', 'error')
    return render_template('admin_movie_form.html', movie={}, movies=movies, page_title='Add a title')


@app.route('/admin/movie/<movie_id>/edit', methods=['GET', 'POST'])
@admin_required
def admin_edit_movie(movie_id):
    movies = get_movies() or []
    movie = next((m for m in movies if str(m.get('id')) == str(movie_id)), None)
    if not movie:
        abort(404)
    if request.method == 'POST':
        try:
            api_request('PUT', f'/movies/{quote(str(movie_id), safe="")}', json=form_payload(), admin=True)
            flash('Your changes have been saved.', 'success')
            return redirect(url_for('admin_dashboard'))
        except (requests.RequestException, RuntimeError, ValueError) as exc:
            flash(f'Could not save changes: {getattr(exc, "response", None).text if getattr(exc, "response", None) is not None else str(exc)}', 'error')
    return render_template('admin_movie_form.html', movie=movie, movies=movies, page_title='Edit title')


@app.route('/admin/movie/<movie_id>/delete', methods=['POST'])
@admin_required
@app.route('/admin/movies/bulk-delete', methods=['POST'])
@admin_required
@app.route('/admin/movies/bulk-delete', methods=['POST'])
@admin_required
def admin_bulk_delete():
    movie_ids = request.form.getlist('movie_ids')

    if not movie_ids:
        flash('Please select at least one title.', 'error')
        return redirect(url_for('admin_dashboard'))

    deleted = 0
    failed = 0

    for movie_id in movie_ids:
        try:
            api_request(
                'DELETE',
                f'/movies/{quote(str(movie_id), safe="")}',
                admin=True
            )
            deleted += 1
        except (requests.RequestException, RuntimeError):
            failed += 1

    if deleted:
        flash(f'Successfully deleted {deleted} title(s).', 'success')

    if failed:
        flash(f'Could not delete {failed} title(s).', 'error')

    return redirect(url_for('admin_dashboard'))


@app.route('/admin/movie/<movie_id>/delete', methods=['POST'])
@admin_required
def admin_delete_movie(movie_id):
    try:
        api_request('DELETE', f'/movies/{quote(str(movie_id), safe="")}', admin=True)
        flash('The title was deleted.', 'success')
    except (requests.RequestException, RuntimeError) as exc:
        flash(f'Could not delete title: {getattr(exc, "response", None).text if getattr(exc, "response", None) is not None else str(exc)}', 'error')
    return redirect(url_for('admin_dashboard'))

@app.errorhandler(404)
def not_found(_error):
    return render_template('error.html', message='We could not find that page.'), 404


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False)
