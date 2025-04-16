
def mkGoogleSignedUrl4download(blob_name, bucket_name='xmusic', credentials='xgcloud.json'):
    import datetime
    from google.cloud import storage
    """Generates a v4 signed URL for downloading a blob.

    Note that this method requires a service account key file. You can not use
    this if you are using Application Default Credentials from Google Compute
    Engine or from the Google Cloud SDK.
    """
    # bucket_name = 'your-bucket-name'
    # blob_name = 'your-object-name'

    # storage_client = storage.Client() #AttributeError: you need a private key to sign credentials.the credentials you are currently using <class 'google.oauth2.credentials.Credentials'> just contains a token. see https://googleapis.dev/python/google-api-core/latest/auth.html#setting-up-a-service-account for more details.
    # https://stackoverflow.com/questions/46540894/blob-generate-signed-url-failing-to-attributeerror
    storage_client = storage.Client.from_service_account_json(credentials)
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_name)

    url = blob.generate_signed_url(
        version="v4",
        # This URL is valid for 1 weeks/max allowed!
        expiration=datetime.timedelta(weeks=1),
        # Allow GET requests using this URL.
        method="GET",
    )

    print("Generated GET signed URL:")
    print(url)
    print("You can use this URL with any user agent, for example:")
    print(f"curl '{url}'")
    return url


def mkGoogleSignedUrl(service_account_file,  bucket_name, object_name, subresource=None,    expiration=604800,    http_method="GET",    query_parameters=None,    headers=None,):
    import binascii
    import collections
    import datetime
    import hashlib
    import sys
    from urllib.parse import quote

    # pip install google-auth
    from google.oauth2 import service_account

    # pip install six
    import six
    if expiration > 604800:
        print("Expiration Time can't be longer than 604800 seconds (7 days).")
        sys.exit(1)

    escaped_object_name = quote(six.ensure_binary(object_name), safe=b"/~")
    canonical_uri = f"/{escaped_object_name}"

    datetime_now = datetime.datetime.now(tz=datetime.timezone.utc)
    request_timestamp = datetime_now.strftime("%Y%m%dT%H%M%SZ")
    datestamp = datetime_now.strftime("%Y%m%d")

    google_credentials = service_account.Credentials.from_service_account_file(
        service_account_file
    )
    client_email = google_credentials.service_account_email
    credential_scope = f"{datestamp}/auto/storage/goog4_request"
    credential = f"{client_email}/{credential_scope}"

    if headers is None:
        headers = dict()
    host = f"{bucket_name}.storage.googleapis.com"
    headers["host"] = host

    canonical_headers = ""
    ordered_headers = collections.OrderedDict(sorted(headers.items()))
    for k, v in ordered_headers.items():
        lower_k = str(k).lower()
        strip_v = str(v).lower()
        canonical_headers += f"{lower_k}:{strip_v}\n"

    signed_headers = ""
    for k, _ in ordered_headers.items():
        lower_k = str(k).lower()
        signed_headers += f"{lower_k};"
    signed_headers = signed_headers[:-1]  # remove trailing ';'

    if query_parameters is None:
        query_parameters = dict()
    query_parameters["X-Goog-Algorithm"] = "GOOG4-RSA-SHA256"
    query_parameters["X-Goog-Credential"] = credential
    query_parameters["X-Goog-Date"] = request_timestamp
    query_parameters["X-Goog-Expires"] = expiration
    query_parameters["X-Goog-SignedHeaders"] = signed_headers
    if subresource:
        query_parameters[subresource] = ""

    canonical_query_string = ""
    ordered_query_parameters = collections.OrderedDict(
        sorted(query_parameters.items()))
    for k, v in ordered_query_parameters.items():
        encoded_k = quote(str(k), safe="")
        encoded_v = quote(str(v), safe="")
        canonical_query_string += f"{encoded_k}={encoded_v}&"
    canonical_query_string = canonical_query_string[:-1]  # remove trailing '&'

    canonical_request = "\n".join(
        [
            http_method,
            canonical_uri,
            canonical_query_string,
            canonical_headers,
            signed_headers,
            "UNSIGNED-PAYLOAD",
        ]
    )

    canonical_request_hash = hashlib.sha256(
        canonical_request.encode()).hexdigest()

    string_to_sign = "\n".join(
        [
            "GOOG4-RSA-SHA256",
            request_timestamp,
            credential_scope,
            canonical_request_hash,
        ]
    )

    # signer.sign() signs using RSA-SHA256 with PKCS1v15 padding
    signature = binascii.hexlify(
        google_credentials.signer.sign(string_to_sign)
    ).decode()

    scheme_and_host = "{}://{}".format("https", host)
    signed_url = "{}{}?{}&x-goog-signature={}".format(
        scheme_and_host, canonical_uri, canonical_query_string, signature
    )

    return signed_url
