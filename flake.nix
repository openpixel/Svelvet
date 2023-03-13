{
  inputs = {
    nixpkgs.url = "nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        libraries = with pkgs;[
        ];

        packages = with pkgs; [
          python39
        ];
      in
      {
        devShell = pkgs.mkShell {
          buildInputs = packages;
        };
      });
}
