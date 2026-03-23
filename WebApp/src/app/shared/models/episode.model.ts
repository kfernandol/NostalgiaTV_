export interface EpisodeRequest {
    title: string;
    filePath?: string;
    season: number;
    episodeTypeId: number;
    seriesId: number;
}

export interface EpisodeResponse {
    id: number;
    title: string;
    filePath?: string;
    season: number;
    episodeTypeId: number;
    episodeTypeName: string;
    seriesId: number;
}
