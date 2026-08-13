{
  pkgs,
  version,
  registryHash,
}:
let
  registryTree = pkgs.stdenvNoCC.mkDerivation {
    pname = "rulesync-registry-tree";
    inherit version;

    nativeBuildInputs = [
      pkgs.nodejs_22
      pkgs.cacert
    ];

    dontUnpack = true;
    dontFixup = true;

    buildPhase = ''
      export HOME="$TMPDIR/home"
      export SSL_CERT_FILE="${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
      export NODE_EXTRA_CA_CERTS="$SSL_CERT_FILE"
      mkdir -p "$HOME" "$out"
      npm install --prefix "$out" --no-audit --no-fund --ignore-scripts \
        --omit=dev --omit=optional "rulesync@${version}"
    '';

    installPhase = ''
      rm -f "$out/package.json" "$out/package-lock.json"
      find "$out" -name '.package-lock.json' -delete
    '';

    outputHashMode = "recursive";
    outputHashAlgo = "sha256";
    outputHash = registryHash;
  };
in
pkgs.runCommandLocal "rulesync-${version}"
  {
    nativeBuildInputs = [ pkgs.makeWrapper ];
    passthru = { inherit registryTree version; };
    meta = {
      description = "Generates native agent harness configuration from one source";
      homepage = "https://github.com/dyoshikawa/rulesync";
      mainProgram = "rulesync";
    };
  }
  ''
    mkdir -p "$out/bin"
    makeWrapper ${pkgs.nodejs_22}/bin/node "$out/bin/rulesync" \
      --add-flags ${registryTree}/node_modules/rulesync/dist/cli/index.js
  ''
